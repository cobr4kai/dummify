import {
  BriefMode,
  IngestionMode,
  IngestionStatus,
  type Paper,
  Prisma,
  TriggerSource,
} from "@prisma/client";
import path from "node:path";
import { DEFAULT_SCORING_VERSION } from "@/config/defaults";
import {
  fetchHistoricalRecordsByWindow,
  type HistoricalRecordsResult,
} from "@/lib/arxiv/backfill";
import { ArxivClient, type ArxivProgressEvent } from "@/lib/arxiv/client";
import { prisma } from "@/lib/db";
import {
  createInitialIngestionProgress,
  IngestionProgressReporter,
  parseIngestionProgress,
} from "@/lib/ingestion/progress";
import {
  type IngestionPhaseKey,
} from "@/lib/ingestion/progress-shared";
import {
  buildOpenAlexSearchText,
  getOpenAlexPayload,
  getOpenAlexTopics,
  getPdfAffiliationPayload,
  getStructuredMetadataPayload,
} from "@/lib/metadata/service";
import {
  PDF_AFFILIATIONS_PROVIDER,
  STRUCTURED_METADATA_PROVIDER,
  type PdfAffiliationEnrichment,
  type StructuredMetadataEnrichment,
} from "@/lib/metadata/schema";
import {
  buildAugmentedPaperSearchText,
  buildPaperPersistenceData,
  paperToSourceRecord,
} from "@/lib/papers/record";
import { extractPdfAffiliationPayloadFromFile } from "@/lib/pdf/affiliations";
import {
  getEnrichmentProviders,
  getTechnicalBriefProvider,
  type EnrichmentContext,
} from "@/lib/providers";
import { getPublishedPaperIdsForDay } from "@/lib/publishing/service";
import { computeBriefScore } from "@/lib/scoring/service";
import { getAppSettings, getEnabledCategoryKeys } from "@/lib/settings/service";
import { ensurePaperTechnicalBrief } from "@/lib/technical/service";
import type { PaperSourceRecord } from "@/lib/types";
import {
  getArxivAnnouncementDateString,
  isExpectedQuietAnnouncementDay,
} from "@/lib/utils/dates";
import { toJsonInput } from "@/lib/utils/prisma";

export type DailyJobMode = "PRIMARY" | "RECONCILE";

const ACTIVE_MANUAL_RUN_WINDOW_MS = 6 * 60 * 60 * 1000;
const ACTIVE_HEARTBEAT_STALE_MS = 5 * 60 * 1000;
const MAX_AUTO_RESUME_ATTEMPTS = 2;
const RESUME_SCORE_CHUNK_SIZE = 125;

type IngestionOptions = {
  mode: "DAILY" | "HISTORICAL";
  triggerSource: TriggerSource;
  categories?: string[];
  announcementDay?: string;
  from?: string;
  to?: string;
  recomputeScores?: boolean;
  recomputeBriefs?: boolean;
  jobMode?: DailyJobMode;
  resumeFromRunId?: string;
};

type PreparedIngestionJob = {
  appSettings: Awaited<ReturnType<typeof getAppSettings>>;
  categories: string[];
  announcementDay: string;
  jobMode: DailyJobMode;
  run: {
    id: string;
  };
  startupLogLine?: string;
};

type HydrateEnrichmentOptions = {
  force?: boolean;
  providers?: string[];
};

type HydrateEnrichmentResult = {
  changed: boolean;
  updatedProviders: string[];
  warnings: string[];
  structuredMetadata: StructuredMetadataEnrichment | null;
};

type IngestionResumeContext = {
  runId: string;
  startedAt: Date;
  scoreFreshSince: Date;
  completedPhases: Set<IngestionPhaseKey>;
  lastPhase: IngestionPhaseKey | null;
};

const ENRICHMENT_CONCURRENCY = 4;
const ENRICHMENT_WARNING_LOG_LIMIT = 20;

const paperEnrichmentInclude = Prisma.validator<Prisma.PaperInclude>()({
  technicalBriefs: {
    where: { isCurrent: true },
    orderBy: { updatedAt: "desc" },
    take: 1,
  },
  enrichments: {
    where: { isCurrent: true },
  },
  publishedItems: {
    take: 1,
  },
});

type PaperWithEnrichmentContext = Prisma.PaperGetPayload<{
  include: typeof paperEnrichmentInclude;
}>;

export async function startIngestionJob(
  options: IngestionOptions,
  startOptions: {
    skipStaleCheck?: boolean;
    startupLogLine?: string;
  } = {},
) {
  if (!startOptions.skipStaleCheck) {
    await closeStaleIngestionRuns();
  }

  const activeRun = await findActiveIngestionRun();
  if (activeRun) {
    return {
      status: "already-running" as const,
      runId: activeRun.id,
    };
  }

  const prepared = await prepareIngestionJob(options, startOptions.startupLogLine);
  void executePreparedIngestionJob(prepared, options)
    .catch((error) => {
      console.error("Background ingest job failed", error);
    });

  return {
    status: "started" as const,
    runId: prepared.run.id,
  };
}

export async function runIngestionJob(options: IngestionOptions) {
  const prepared = await prepareIngestionJob(options);
  return executePreparedIngestionJob(prepared, options);
}

async function prepareIngestionJob(
  options: IngestionOptions,
  startupLogLine?: string,
): Promise<PreparedIngestionJob> {
  const appSettings = await getAppSettings();
  const categories = options.categories?.length
    ? options.categories
    : await getEnabledCategoryKeys();
  const announcementDay =
    options.announcementDay ?? getArxivAnnouncementDateString();
  const jobMode = options.jobMode ?? "PRIMARY";
  const initialProgress = createInitialIngestionProgress(options.mode as IngestionMode);

  const run = await prisma.ingestionRun.create({
    data: {
      mode: options.mode as IngestionMode,
      status: IngestionStatus.RUNNING,
      triggerSource: options.triggerSource,
      categories: toJsonInput(categories),
      requestedFrom: new Date(`${options.from ?? announcementDay}T00:00:00.000Z`),
      requestedTo: new Date(`${options.to ?? announcementDay}T23:59:59.999Z`),
      recomputeScores: Boolean(options.recomputeScores),
      recomputeSummaries: Boolean(options.recomputeBriefs),
      logLines: toJsonInput([]),
      progressJson: toJsonInput(initialProgress),
    },
  });

  return {
    appSettings,
    categories,
    announcementDay,
    jobMode,
    run,
    startupLogLine,
  };
}

async function executePreparedIngestionJob(
  prepared: PreparedIngestionJob,
  options: IngestionOptions,
) {
  const { appSettings, categories, announcementDay, jobMode, run, startupLogLine } = prepared;
  const logLines: string[] = [];
  const tracker = new IngestionProgressReporter(run.id, options.mode as IngestionMode);
  const resumeFromRunId =
    options.resumeFromRunId ??
    (await findMatchingResumeCandidateRunId({
      options,
      categories,
      announcementDay,
    }));
  const resumeContext = resumeFromRunId
    ? await getIngestionResumeContext(resumeFromRunId)
    : null;
  const arxivClient = new ArxivClient({
    apiMinDelayMs: appSettings.apiMinDelayMs,
    rssMinDelayMs: appSettings.rssMinDelayMs,
    retryBaseDelayMs: appSettings.retryBaseDelayMs,
    apiCacheTtlMinutes: appSettings.apiCacheTtlMinutes,
    feedCacheTtlMinutes: appSettings.feedCacheTtlMinutes,
    cacheRoot: path.resolve(appSettings.pdfCacheDir),
    onProgress: (event) => handleArxivProgressEvent(tracker, event, options.mode),
  });

  try {
    await tracker.initialize();
    if (startupLogLine) {
      logLines.push(startupLogLine);
    }
    if (resumeContext) {
      logLines.push(
        `Resuming from checkpointed ingest run ${resumeContext.runId} at ${resumeContext.lastPhase ?? "the last recorded phase"}.`,
      );
    }
    logLines.push(
      options.mode === "DAILY"
        ? `Starting ${jobMode.toLowerCase()} daily ingestion for the operator brief.`
        : "Starting historical ingestion for the operator brief.",
    );

    let historicalResult: Omit<HistoricalRecordsResult, "records"> | null = null;
    let fetchedCount = 0;
    const upsertedPaperIds: string[] = [];
    const canResumeAfterUpsert = Boolean(
      resumeContext?.completedPhases.has("upsert_papers"),
    );

    if (canResumeAfterUpsert) {
      const resumedPaperIds = await getPaperIdsForIngestWindow({
        from: options.from ?? announcementDay,
        to: options.to ?? announcementDay,
        categories,
      });
      upsertedPaperIds.push(...resumedPaperIds);
      fetchedCount = resumedPaperIds.length;

      await markSourcePhasesResumed({
        tracker,
        mode: options.mode,
        count: resumedPaperIds.length,
      });
    } else if (options.mode === "DAILY") {
      await tracker.startPhase("discover_feeds", {
        message: `Scanning ${categories.length} arXiv feeds for ${announcementDay}.`,
        total: categories.length,
        processed: 0,
      });
      const papers = await arxivClient.fetchDaily(categories, announcementDay);
      fetchedCount = papers.length;
      await tracker.completePhase(
        "discover_feeds",
        `Discovered ${papers.length} papers from the daily arXiv feeds.`,
      );
      await tracker.completePhase(
        "hydrate_arxiv_records",
        papers.length > 0
          ? `Hydrated ${papers.length} arXiv records.`
          : "No arXiv ids required hydration after feed discovery.",
      );

      await tracker.startPhase("upsert_papers", {
        message: papers.length > 0 ? "Saving papers into the archive." : "No papers to upsert.",
        total: papers.length,
        processed: 0,
      });
      await upsertPaperBatch({
        papers,
        total: papers.length,
        upsertedPaperIds,
        tracker,
      });
    } else {
      await tracker.startPhase("fetch_historical_window", {
        message: `Fetching historical windows from ${options.from} to ${options.to}.`,
      });
      await tracker.startPhase("upsert_papers", {
        message: "Saving historical papers as each window completes.",
        processed: 0,
      });
      historicalResult = await fetchHistoricalRecordsByWindow({
        client: arxivClient,
        categories,
        from: options.from!,
        to: options.to!,
        onProgress: async (event) => {
          if (event.type === "window-start") {
            await tracker.updatePhase("fetch_historical_window", {
              processed: event.index - 1,
              total: event.totalWindows,
              message: `Fetching historical window ${event.index} of ${event.totalWindows} (${event.from}).`,
              force: true,
            });
            return;
          }

          if (event.type === "window-warning") {
            await tracker.addWarnings(
              1,
              `Historical window ${event.index} of ${event.totalWindows} hit a warning and continued.`,
            );
            return;
          }

          await tracker.updatePhase("fetch_historical_window", {
            processed: event.index,
            total: event.totalWindows,
            message: `Fetched historical window ${event.index} of ${event.totalWindows} (${event.fetchedCount} new papers from ${event.from}).`,
            force: event.index === event.totalWindows || event.index === 1,
          });
        },
        onWindowRecords: async (event) => {
          fetchedCount += event.records.length;
          await upsertPaperBatch({
            papers: event.records,
            total: fetchedCount,
            upsertedPaperIds,
            tracker,
          });
        },
      });
      await tracker.completePhase(
        "fetch_historical_window",
        `Fetched ${fetchedCount} papers across the requested historical windows.`,
      );
      await tracker.completePhase(
        "hydrate_arxiv_records",
        fetchedCount > 0
          ? `Hydrated ${fetchedCount} historical arXiv records.`
          : "No historical arXiv records were hydrated for the requested window.",
      );
    }

    await tracker.completePhase(
      "upsert_papers",
      `Saved ${upsertedPaperIds.length} papers into the archive.`,
    );

    logLines.push(`Fetched ${fetchedCount} paper records from arXiv.`);
    if (
      options.mode === "DAILY" &&
      fetchedCount === 0 &&
      isExpectedQuietAnnouncementDay(announcementDay)
    ) {
      logLines.push(
        "No new announcements were expected for this Friday/Saturday arXiv quiet day.",
      );
    }
    if (options.mode === "HISTORICAL" && fetchedCount === 0) {
      logLines.push("No arXiv records were found in the requested historical window.");
    }
    if (historicalResult?.warnings.length) {
      appendHistoricalWarnings(logLines, historicalResult);
      await tracker.addWarnings(
        historicalResult.warnings.length,
        "Historical fetch completed with warnings.",
      );
    }

    let briefCount = 0;
    const briefProvider = getTechnicalBriefProvider();
    const paperIdsForBriefs = briefProvider
      ? await resolvePaperIdsForBriefs({
          mode: options.mode,
          announcementDay,
        })
      : [];

    if (resumeContext?.completedPhases.has("generate_briefs")) {
      await tracker.completePhase(
        "generate_briefs",
        "Skipped brief generation because the interrupted run already completed this phase.",
      );
    } else if (briefProvider) {
      await tracker.startPhase("generate_briefs", {
        message:
          paperIdsForBriefs.length > 0
            ? `Generating homepage briefs for ${paperIdsForBriefs.length} curated papers.`
            : "No curated papers needed brief generation for this run.",
        total: paperIdsForBriefs.length,
        processed: 0,
      });
      for (const [index, paperId] of paperIdsForBriefs.entries()) {
        const briefResult = await ensurePaperTechnicalBrief(paperId, {
          force: Boolean(options.recomputeBriefs),
          requirePdf: true,
        });
        if (briefResult === "generated") {
          briefCount += 1;
        }
        if (briefResult === "pdf-required") {
          logLines.push(
            `Skipped executive brief for homepage paper ${paperId} because full PDF extraction was unavailable.`,
          );
        }
        await tracker.updatePhase("generate_briefs", {
          processed: index + 1,
          total: paperIdsForBriefs.length,
          message: `Generated ${briefCount} of ${paperIdsForBriefs.length} homepage briefs.`,
          force:
            index === 0 ||
            index + 1 === paperIdsForBriefs.length ||
            (index + 1) % 10 === 0,
        });
      }
      await tracker.completePhase(
        "generate_briefs",
        paperIdsForBriefs.length > 0
          ? `Generated ${briefCount} homepage briefs.`
          : "No curated papers needed brief generation for this run.",
      );
    } else {
      logLines.push("Skipped executive briefs because OPENAI_API_KEY is not configured.");
    }

    let openAlexProcessed = 0;
    const openAlexUpdatedPaperIds = new Set<string>();
    const enrichmentWarnings: string[] = [];

    if (resumeContext?.completedPhases.has("enrich_openalex")) {
      openAlexProcessed = upsertedPaperIds.length;
      await tracker.completePhase(
        "enrich_openalex",
        "Skipped OpenAlex enrichment because the interrupted run already completed this phase.",
      );
    } else {
      await tracker.startPhase("enrich_openalex", {
        message:
          upsertedPaperIds.length > 0
            ? `Refreshing OpenAlex enrichment for ${upsertedPaperIds.length} papers.`
            : "No papers needed OpenAlex enrichment.",
        total: upsertedPaperIds.length,
        processed: 0,
      });
      await forEachWithConcurrency(
        upsertedPaperIds,
        ENRICHMENT_CONCURRENCY,
        async (paperId) => {
          const result = await hydratePaperEnrichments(paperId, {
            force: false,
            providers: ["openalex"],
          });
          if (result.updatedProviders.includes("openalex")) {
            openAlexUpdatedPaperIds.add(paperId);
          }
          for (const warning of result.warnings) {
            enrichmentWarnings.push(`Paper ${paperId}: ${warning}`);
          }
          openAlexProcessed += 1;
          await tracker.updatePhase("enrich_openalex", {
            processed: openAlexProcessed,
            total: upsertedPaperIds.length,
            message: `Enriched OpenAlex for ${openAlexProcessed} of ${upsertedPaperIds.length} papers.`,
            force:
              openAlexProcessed === 1 ||
              openAlexProcessed === upsertedPaperIds.length ||
              openAlexProcessed % 25 === 0,
          });
        },
      );
      await tracker.completePhase(
        "enrich_openalex",
        upsertedPaperIds.length > 0
          ? `Processed OpenAlex enrichment for ${upsertedPaperIds.length} papers.`
          : "No papers needed OpenAlex enrichment.",
      );
    }

    let structuredProcessed = 0;
    let structuredMetadataCount = 0;
    const structuredMetadataUpdatedPaperIds = new Set<string>();

    if (resumeContext?.completedPhases.has("enrich_structured_metadata")) {
      structuredProcessed = upsertedPaperIds.length;
      await tracker.completePhase(
        "enrich_structured_metadata",
        "Skipped structured metadata because the interrupted run already completed this phase.",
      );
    } else {
      await tracker.startPhase("enrich_structured_metadata", {
        message:
          upsertedPaperIds.length > 0
            ? `Generating structured metadata for ${upsertedPaperIds.length} papers.`
            : "No papers needed structured metadata.",
        total: upsertedPaperIds.length,
        processed: 0,
      });
      await forEachWithConcurrency(
        upsertedPaperIds,
        ENRICHMENT_CONCURRENCY,
        async (paperId) => {
          const result = await hydratePaperEnrichments(paperId, {
            force: openAlexUpdatedPaperIds.has(paperId),
            providers: [STRUCTURED_METADATA_PROVIDER],
          });
          if (result.updatedProviders.includes(STRUCTURED_METADATA_PROVIDER)) {
            structuredMetadataCount += 1;
            structuredMetadataUpdatedPaperIds.add(paperId);
          }
          for (const warning of result.warnings) {
            enrichmentWarnings.push(`Paper ${paperId}: ${warning}`);
          }
          structuredProcessed += 1;
          await tracker.updatePhase("enrich_structured_metadata", {
            processed: structuredProcessed,
            total: upsertedPaperIds.length,
            message: `Generated structured metadata for ${structuredProcessed} of ${upsertedPaperIds.length} papers.`,
            force:
              structuredProcessed === 1 ||
              structuredProcessed === upsertedPaperIds.length ||
              structuredProcessed % 25 === 0,
          });
        },
      );
      await tracker.completePhase(
        "enrich_structured_metadata",
        upsertedPaperIds.length > 0
          ? `Processed structured metadata for ${upsertedPaperIds.length} papers.`
          : "No papers needed structured metadata.",
      );
    }

    if (structuredMetadataCount > 0) {
      logLines.push(
        `Hydrated structured metadata for ${structuredMetadataCount} papers during ingestion.`,
      );
    }
    appendEnrichmentWarnings(logLines, enrichmentWarnings);
    await tracker.addWarnings(enrichmentWarnings.length);

    let scoreCount = 0;
    let scoredProcessed = 0;
    let scoreSkippedFromResume = 0;
    let resumeScoreBudgetRemaining = resumeContext ? RESUME_SCORE_CHUNK_SIZE : null;

    if (resumeContext?.completedPhases.has("score_papers")) {
      await tracker.completePhase(
        "score_papers",
        "Skipped scoring because the interrupted run already completed this phase.",
      );
    } else {
      await tracker.startPhase("score_papers", {
        message:
          upsertedPaperIds.length > 0
            ? `Refreshing scores for ${upsertedPaperIds.length} papers.`
            : "No papers needed score updates.",
        total: upsertedPaperIds.length,
        processed: 0,
      });

      for (const [index, paperId] of upsertedPaperIds.entries()) {
        const alreadyScoredInInterruptedRun = resumeContext
          ? await hasCurrentScoreSince(paperId, resumeContext.scoreFreshSince)
          : false;
        if (alreadyScoredInInterruptedRun) {
          scoreSkippedFromResume += 1;
          await tracker.updatePhase("score_papers", {
            processed: index + 1,
            total: upsertedPaperIds.length,
            message: `Resumed scoring; ${scoreSkippedFromResume} papers already had fresh scores from the interrupted run.`,
            force:
              index === 0 ||
              index + 1 === upsertedPaperIds.length ||
              (index + 1) % 25 === 0,
          });
          continue;
        }

        const shouldScore =
          Boolean(options.recomputeScores) ||
          structuredMetadataUpdatedPaperIds.has(paperId) ||
          !(await hasCurrentScore(paperId));

        if (!shouldScore) {
          continue;
        }

        const [sourceRecord, structuredMetadata] = await Promise.all([
          getPaperSourceRecordById(paperId),
          getCurrentStructuredMetadata(paperId),
        ]);
        if (!sourceRecord) {
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await replaceCurrentScore(
            tx,
            paperId,
            sourceRecord,
            appSettings.genAiRankingWeights,
            structuredMetadata,
          );
        });
        scoreCount += 1;
        scoredProcessed += 1;
        await tracker.updatePhase("score_papers", {
          processed: index + 1,
          total: upsertedPaperIds.length,
          message: `Scored ${scoredProcessed} of ${upsertedPaperIds.length} papers.`,
          force:
            index === 0 ||
            index + 1 === upsertedPaperIds.length ||
            (index + 1) % 25 === 0,
        });

        if (resumeScoreBudgetRemaining !== null) {
          resumeScoreBudgetRemaining -= 1;
          if (resumeScoreBudgetRemaining <= 0 && index + 1 < upsertedPaperIds.length) {
            const pauseMessage = `Paused checkpoint resume after scoring ${scoreCount} papers in this pass. Use Resume from checkpoint to continue without repeating completed work.`;
            logLines.push(pauseMessage);
            await tracker.updatePhase("score_papers", {
              processed: index + 1,
              total: upsertedPaperIds.length,
              message: pauseMessage,
              force: true,
            });
            await tracker.markFailed(pauseMessage);
            await prisma.ingestionRun.update({
              where: { id: run.id },
              data: {
                status: IngestionStatus.FAILED,
                fetchedCount,
                upsertedCount: upsertedPaperIds.length,
                scoreCount,
                summaryCount: briefCount,
                completedAt: new Date(),
                errorMessage: pauseMessage,
                logLines: toJsonInput(logLines),
              },
            });

            return {
              runId: run.id,
              status: IngestionStatus.FAILED,
              fetchedCount,
              upsertedCount: upsertedPaperIds.length,
              scoreCount,
              summaryCount: briefCount,
              briefCount,
            };
          }
        }
      }
      await tracker.completePhase(
        "score_papers",
        upsertedPaperIds.length > 0
          ? `Scored ${scoreCount} papers${scoreSkippedFromResume > 0 ? ` and reused ${scoreSkippedFromResume} fresh scores from the interrupted run` : ""}.`
          : "No papers needed score updates.",
      );
    }

    const status =
      historicalResult?.warnings.length
        ? IngestionStatus.PARTIAL
        : options.mode === "DAILY" &&
            fetchedCount === 0 &&
            !isExpectedQuietAnnouncementDay(announcementDay)
          ? IngestionStatus.PARTIAL
          : IngestionStatus.COMPLETED;

    await tracker.finish(
      status === IngestionStatus.PARTIAL
        ? "Ingest completed with warnings."
        : "Ingest completed successfully.",
    );
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status,
        fetchedCount,
        upsertedCount: upsertedPaperIds.length,
        scoreCount,
        summaryCount: briefCount,
        completedAt: new Date(),
        logLines: toJsonInput(logLines),
      },
    });

    return {
      runId: run.id,
      status,
      fetchedCount,
      upsertedCount: upsertedPaperIds.length,
      scoreCount,
      summaryCount: briefCount,
      briefCount,
    };
  } catch (error) {
    logLines.push(error instanceof Error ? error.message : "Unknown ingestion failure.");
    await tracker.markFailed(
      error instanceof Error ? error.message : "Unknown ingestion failure.",
    );

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: IngestionStatus.FAILED,
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        logLines: toJsonInput(logLines),
      },
    });

    throw error;
  }
}

async function resolvePaperIdsForBriefs(input: {
  mode: IngestionOptions["mode"];
  announcementDay: string;
}) {
  if (input.mode !== "DAILY") {
    return [];
  }

  return getPublishedPaperIdsForDay(input.announcementDay);
}

export async function ensurePaperEnrichment(
  paperId: string,
  options: HydrateEnrichmentOptions = {},
) {
  const result = await hydratePaperEnrichments(paperId, options);
  return result.changed;
}

export async function ensurePaperPdfAffiliations(
  paperId: string,
  options: { force?: boolean } = {},
) {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: {
      enrichments: {
        where: { isCurrent: true },
      },
      pdfCaches: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!paper) {
    return false;
  }

  const existing = getPdfAffiliationPayload(
    paper.enrichments.map((enrichment) => ({
      provider: enrichment.provider,
      payload: enrichment.payload,
    })),
  );
  if (existing && !options.force) {
    return false;
  }

  const pdfCache = paper.pdfCaches[0];
  if (!pdfCache?.extractedJsonPath) {
    return false;
  }

  const payload = await extractPdfAffiliationPayloadFromFile(pdfCache.extractedJsonPath).catch(
    () => null,
  );
  if (!payload) {
    return false;
  }

  await replaceCurrentPdfAffiliationEnrichment(paper.id, payload);
  return true;
}

export async function backfillStructuredMetadata(options: {
  paperIds?: string[];
  fromAnnouncementDay?: string;
  toAnnouncementDay?: string;
  force?: boolean;
} = {}) {
  const appSettings = await getAppSettings();
  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      ...(options.paperIds?.length ? { id: { in: options.paperIds } } : {}),
      ...((options.fromAnnouncementDay || options.toAnnouncementDay)
        ? {
            announcementDay: {
              ...(options.fromAnnouncementDay
                ? { gte: options.fromAnnouncementDay }
                : {}),
              ...(options.toAnnouncementDay ? { lte: options.toAnnouncementDay } : {}),
            },
          }
        : {}),
    },
  });

  let updatedCount = 0;
  let scoreCount = 0;

  await mapWithConcurrency(papers, ENRICHMENT_CONCURRENCY, async (paper) => {
    const result = await hydratePaperEnrichments(paper.id, {
      force: options.force ?? true,
      providers: [STRUCTURED_METADATA_PROVIDER],
    });

    if (!result.updatedProviders.includes(STRUCTURED_METADATA_PROVIDER)) {
      return;
    }

    updatedCount += 1;
    await prisma.$transaction(async (tx) => {
      await replaceCurrentScore(
        tx,
        paper.id,
        paperToSourceRecord(paper),
        appSettings.genAiRankingWeights,
        result.structuredMetadata,
      );
    });
    scoreCount += 1;
  });

  return {
    paperCount: papers.length,
    updatedCount,
    scoreCount,
  };
}

export async function backfillOpenAlexForPublishedPapers(options: {
  paperIds?: string[];
  fromAnnouncementDay?: string;
  toAnnouncementDay?: string;
  force?: boolean;
} = {}) {
  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      publishedItems: {
        some: {},
      },
      ...(options.paperIds?.length ? { id: { in: options.paperIds } } : {}),
      ...((options.fromAnnouncementDay || options.toAnnouncementDay)
        ? {
            announcementDay: {
              ...(options.fromAnnouncementDay
                ? { gte: options.fromAnnouncementDay }
                : {}),
              ...(options.toAnnouncementDay ? { lte: options.toAnnouncementDay } : {}),
            },
          }
        : {}),
    },
  });

  let updatedCount = 0;

  await mapWithConcurrency(papers, Math.min(ENRICHMENT_CONCURRENCY, 2), async (paper) => {
    const result = await hydratePaperEnrichments(paper.id, {
      force: options.force ?? true,
      providers: ["openalex"],
    });

    if (result.updatedProviders.includes("openalex")) {
      updatedCount += 1;
    }
  });

  return {
    paperCount: papers.length,
    updatedCount,
  };
}

export async function backfillPdfAffiliationsForPublishedPapers(options: {
  paperIds?: string[];
  fromAnnouncementDay?: string;
  toAnnouncementDay?: string;
  force?: boolean;
} = {}) {
  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      publishedItems: {
        some: {},
      },
      pdfCaches: {
        some: {
          isCurrent: true,
          extractedJsonPath: {
            not: null,
          },
        },
      },
      ...(options.paperIds?.length ? { id: { in: options.paperIds } } : {}),
      ...((options.fromAnnouncementDay || options.toAnnouncementDay)
        ? {
            announcementDay: {
              ...(options.fromAnnouncementDay
                ? { gte: options.fromAnnouncementDay }
                : {}),
              ...(options.toAnnouncementDay ? { lte: options.toAnnouncementDay } : {}),
            },
          }
        : {}),
    },
    include: {
      enrichments: {
        where: { isCurrent: true },
      },
      pdfCaches: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  let updatedCount = 0;

  await mapWithConcurrency(papers, Math.min(ENRICHMENT_CONCURRENCY, 2), async (paper) => {
    const existing = getPdfAffiliationPayload(
      paper.enrichments.map((enrichment) => ({
        provider: enrichment.provider,
        payload: enrichment.payload,
      })),
    );
    if (existing && !options.force) {
      return;
    }

    const extractedJsonPath = paper.pdfCaches[0]?.extractedJsonPath;
    if (!extractedJsonPath) {
      return;
    }

    const payload = await extractPdfAffiliationPayloadFromFile(extractedJsonPath).catch(
      () => null,
    );
    if (!payload) {
      return;
    }

    await replaceCurrentPdfAffiliationEnrichment(paper.id, payload);
    updatedCount += 1;
  });

  return {
    paperCount: papers.length,
    updatedCount,
  };
}

async function hydratePaperEnrichments(
  paperId: string,
  options: HydrateEnrichmentOptions = {},
): Promise<HydrateEnrichmentResult> {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: paperEnrichmentInclude,
  });

  if (!paper) {
    return {
      changed: false,
      updatedProviders: [],
      warnings: [],
      structuredMetadata: null,
    };
  }

  const paperRecord = paperToSourceRecord(paper);
  let currentEnrichments = paper.enrichments.map((enrichment) => ({
    provider: enrichment.provider,
    payload: toRecordPayload(enrichment.payload),
  }));
  const updatedProviders = new Set<string>();
  const warnings: string[] = [];

  for (const provider of getEnrichmentProviders().filter((candidate) =>
    options.providers?.length ? options.providers.includes(candidate.provider) : true,
  )) {
    const existing = currentEnrichments.find(
      (enrichment) => enrichment.provider === provider.provider,
    );
    const shouldForceProvider =
      Boolean(options.force) ||
      enrichmentNeedsRefresh(provider.provider, existing?.payload) ||
      (provider.provider === STRUCTURED_METADATA_PROVIDER &&
        updatedProviders.has("openalex"));

    if (existing && !shouldForceProvider) {
      continue;
    }

    try {
      const result = await provider.enrich(
        paperRecord,
        buildEnrichmentContext(paper, currentEnrichments),
      );
      if (!result) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.paperEnrichment.updateMany({
          where: {
            paperId,
            provider: result.provider,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
          },
        });

        await tx.paperEnrichment.create({
          data: {
            paperId,
            provider: result.provider,
            providerRecordId: result.providerRecordId,
            payload: toJsonInput(result.payload),
          },
        });
      });

      currentEnrichments = [
        ...currentEnrichments.filter((enrichment) => enrichment.provider !== result.provider),
        {
          provider: result.provider,
          payload: result.payload,
        },
      ];
      updatedProviders.add(result.provider);

      if (result.provider === STRUCTURED_METADATA_PROVIDER || result.provider === "openalex") {
        const structuredMetadata = getStructuredMetadataPayload(currentEnrichments);
        const openAlexSearchText = buildOpenAlexSearchText(currentEnrichments);
        await prisma.paper.update({
          where: { id: paperId },
          data: {
            searchText: buildAugmentedPaperSearchText(paperRecord, [
              structuredMetadata?.searchText ?? "",
              openAlexSearchText,
            ]),
          },
        });
      }

      if (result.warnings?.length) {
        warnings.push(...result.warnings);
      }
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `${provider.provider}: ${error.message}`
          : `${provider.provider}: unknown enrichment error.`,
      );
    }
  }

  return {
    changed: updatedProviders.size > 0,
    updatedProviders: Array.from(updatedProviders),
    warnings,
    structuredMetadata: getStructuredMetadataPayload(currentEnrichments),
  };
}

function buildEnrichmentContext(
  paper: PaperWithEnrichmentContext,
  currentEnrichments: Array<{ provider: string; payload: Record<string, unknown> }>,
): EnrichmentContext {
  return {
    paperId: paper.id,
    announcementDay: paper.announcementDay,
    isEditorial: paper.publishedItems.length > 0 && hasPdfBackedBrief(paper),
    hasPdfBackedBrief: hasPdfBackedBrief(paper),
    currentOpenAlexTopics: getOpenAlexTopics(currentEnrichments),
    currentEnrichments,
  };
}

function hasPdfBackedBrief(
  paper: Pick<PaperWithEnrichmentContext, "technicalBriefs">,
) {
  return paper.technicalBriefs.some((brief) => !brief.usedFallbackAbstract);
}

function toRecordPayload(payload: unknown) {
  if (typeof payload === "object" && payload) {
    return payload as Record<string, unknown>;
  }

  return {};
}

async function replaceCurrentPdfAffiliationEnrichment(
  paperId: string,
  payload: PdfAffiliationEnrichment,
) {
  await prisma.$transaction(async (tx) => {
    await tx.paperEnrichment.updateMany({
      where: {
        paperId,
        provider: PDF_AFFILIATIONS_PROVIDER,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    await tx.paperEnrichment.create({
      data: {
        paperId,
        provider: PDF_AFFILIATIONS_PROVIDER,
        providerRecordId: null,
        payload: toJsonInput(payload),
      },
    });
  });
}

function enrichmentNeedsRefresh(
  provider: string,
  payload: Record<string, unknown> | undefined,
) {
  if (!payload || provider !== "openalex") {
    return false;
  }

  const parsed = getOpenAlexPayload([{ provider, payload }]);
  return Boolean(parsed && (!parsed.matchedBy || !Array.isArray(parsed.institutions)));
}

async function upsertPaper(tx: Prisma.TransactionClient, paper: PaperSourceRecord) {
  const persistenceData = buildPaperPersistenceData(paper, {
    isDemoData: false,
    lastSeenAt: new Date(),
  });

  return tx.paper.upsert({
    where: { arxivId: paper.arxivId },
    update: persistenceData,
    create: {
      arxivId: paper.arxivId,
      ...persistenceData,
    },
  });
}

async function upsertPaperBatch(input: {
  papers: PaperSourceRecord[];
  total: number;
  upsertedPaperIds: string[];
  tracker: IngestionProgressReporter;
}) {
  for (const paper of input.papers) {
    const record = await prisma.$transaction(async (tx) => upsertPaper(tx, paper));
    input.upsertedPaperIds.push(record.id);
    const processed = input.upsertedPaperIds.length;
    await input.tracker.updatePhase("upsert_papers", {
      processed,
      total: input.total,
      message: `Saved ${processed} of ${input.total} papers.`,
      force: processed === 1 || processed === input.total || processed % 25 === 0,
    });
  }
}

async function markSourcePhasesResumed(input: {
  tracker: IngestionProgressReporter;
  mode: IngestionOptions["mode"];
  count: number;
}) {
  if (input.mode === "DAILY") {
    await input.tracker.completePhase(
      "discover_feeds",
      `Resumed after feed discovery; ${input.count} papers are already stored for this day.`,
    );
  } else {
    await input.tracker.completePhase(
      "fetch_historical_window",
      `Resumed after historical fetch; ${input.count} papers are already stored for this window.`,
    );
  }

  await input.tracker.completePhase(
    "hydrate_arxiv_records",
    `Resumed after arXiv hydration; ${input.count} records are already available locally.`,
  );
  await input.tracker.completePhase(
    "upsert_papers",
    `Resumed after upsert; ${input.count} papers are already saved in the archive.`,
  );
}

async function getPaperIdsForIngestWindow(input: {
  from: string;
  to: string;
  categories: string[];
}) {
  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      announcementDay: {
        gte: input.from,
        lte: input.to,
      },
    },
    select: {
      id: true,
      primaryCategory: true,
      categoriesJson: true,
      sourceFeedCategoriesJson: true,
    },
    orderBy: [
      {
        announcementDay: "asc",
      },
      {
        publishedAt: "asc",
      },
      {
        id: "asc",
      },
    ],
  });

  const categorySet = new Set(input.categories);
  return papers
    .filter((paper) => {
      if (categorySet.size === 0) {
        return true;
      }

      const categories = new Set([
        paper.primaryCategory ?? "",
        ...parseJsonStringList(paper.categoriesJson),
        ...parseJsonStringList(paper.sourceFeedCategoriesJson),
      ]);
      return Array.from(categorySet).some((category) => categories.has(category));
    })
    .map((paper) => paper.id);
}

async function hasCurrentScore(paperId: string) {
  const count = await prisma.paperScore.count({
    where: {
      paperId,
      mode: BriefMode.GENAI,
      isCurrent: true,
    },
  });

  return count > 0;
}

async function hasCurrentScoreSince(paperId: string, since: Date) {
  const count = await prisma.paperScore.count({
    where: {
      paperId,
      mode: BriefMode.GENAI,
      isCurrent: true,
      createdAt: {
        gte: since,
      },
    },
  });

  return count > 0;
}

async function getCurrentStructuredMetadata(paperId: string) {
  const enrichment = await prisma.paperEnrichment.findFirst({
    where: {
      paperId,
      provider: STRUCTURED_METADATA_PROVIDER,
      isCurrent: true,
    },
    select: {
      payload: true,
    },
  });

  if (!enrichment) {
    return null;
  }

  return getStructuredMetadataPayload([
    {
      provider: STRUCTURED_METADATA_PROVIDER,
      payload: toRecordPayload(enrichment.payload),
    },
  ]);
}

async function getPaperSourceRecordById(paperId: string) {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
  });

  return paper ? paperToSourceRecord(paper) : null;
}

async function replaceCurrentScore(
  tx: Prisma.TransactionClient,
  paperId: string,
  paper: PaperSourceRecord,
  rankingWeights: Parameters<typeof computeBriefScore>[1],
  structuredMetadata: StructuredMetadataEnrichment | null,
) {
  const score = computeBriefScore(paper, rankingWeights, structuredMetadata);

  await tx.paperScore.updateMany({
    where: {
      paperId,
      mode: BriefMode.GENAI,
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });

  await tx.paperScore.create({
    data: {
      paperId,
      mode: BriefMode.GENAI,
      scoringVersion: DEFAULT_SCORING_VERSION,
      totalScore: score.totalScore,
      businessRelevanceScore: score.frontierRelevanceScore,
      strategyFitScore: 0,
      financeFitScore: 0,
      procurementFitScore: 0,
      breakdown: toJsonInput(score.breakdown),
      audienceFit: toJsonInput({}),
      focusAreas: Prisma.JsonNull,
      weights: toJsonInput(rankingWeights),
      rationale: score.rationale,
    },
  });
}

function appendEnrichmentWarnings(logLines: string[], warnings: string[]) {
  if (warnings.length === 0) {
    return;
  }

  const groupedWarnings = new Map<string, { count: number; sample: string }>();

  for (const warning of warnings) {
    const summaryKey = warning.replace(/^Paper\s+\S+:\s+/, "");
    const existing = groupedWarnings.get(summaryKey);
    if (existing) {
      existing.count += 1;
      continue;
    }

    groupedWarnings.set(summaryKey, {
      count: 1,
      sample: warning,
    });
  }

  const summaryLines = Array.from(groupedWarnings.entries()).map(([summaryKey, details]) => {
    if (details.count === 1) {
      return details.sample;
    }

    if (summaryKey.startsWith("Structured metadata model fallback:")) {
      return `Structured metadata fell back to deterministic-only for ${details.count} papers: ${summaryKey.replace("Structured metadata model fallback: ", "")}`;
    }

    return `${summaryKey} (${details.count} papers)`;
  });

  for (const warning of summaryLines.slice(0, ENRICHMENT_WARNING_LOG_LIMIT)) {
    logLines.push(warning);
  }

  if (summaryLines.length > ENRICHMENT_WARNING_LOG_LIMIT) {
    logLines.push(
      `Suppressed ${summaryLines.length - ENRICHMENT_WARNING_LOG_LIMIT} additional enrichment warning groups.`,
    );
  }
}

export async function getActiveIngestionRun(options?: { now?: Date }) {
  await closeStaleIngestionRuns(options);

  return findActiveIngestionRun();
}

async function getIngestionResumeContext(
  runId: string,
): Promise<IngestionResumeContext | null> {
  const run = await prisma.ingestionRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      startedAt: true,
      mode: true,
      categories: true,
      requestedFrom: true,
      requestedTo: true,
      recomputeScores: true,
      recomputeSummaries: true,
      progressJson: true,
    },
  });

  const progress = parseIngestionProgress(run?.progressJson);
  if (!run || !progress) {
    return null;
  }

  const scoreFreshSince = await getResumeScoreFreshSince(run);

  return {
    runId: run.id,
    startedAt: run.startedAt,
    scoreFreshSince,
    completedPhases: new Set(
      progress.phases
        .filter((phase) => phase.status === "completed")
        .map((phase) => phase.key),
    ),
    lastPhase:
      progress.currentPhase ??
      progress.phases.findLast((phase) => phase.status !== "pending")?.key ??
      null,
  };
}

async function getResumeScoreFreshSince(run: {
  id: string;
  startedAt: Date;
  mode: IngestionMode;
  categories: Prisma.JsonValue;
  requestedFrom: Date | null;
  requestedTo: Date | null;
  recomputeScores: boolean;
  recomputeSummaries: boolean;
}) {
  const relatedFailedRuns = await prisma.ingestionRun.findMany({
    where: {
      mode: run.mode,
      status: IngestionStatus.FAILED,
      requestedFrom: run.requestedFrom,
      requestedTo: run.requestedTo,
      recomputeScores: run.recomputeScores,
      recomputeSummaries: run.recomputeSummaries,
    },
    orderBy: {
      startedAt: "asc",
    },
    select: {
      startedAt: true,
      categories: true,
      progressJson: true,
      errorMessage: true,
    },
  });

  const runCategories = parseCategoryList(run.categories) ?? [];
  const earliestRelatedRun = relatedFailedRuns.find((candidate) => {
    const progress = parseIngestionProgress(candidate.progressJson);
    const candidateCategories = parseCategoryList(candidate.categories) ?? [];
    const errorMessage = String(candidate.errorMessage ?? "");

    return (
      progress &&
      sameStringSet(candidateCategories, runCategories) &&
      (errorMessage.includes("no ingest heartbeat") ||
        errorMessage.includes("Paused checkpoint resume"))
    );
  });

  return earliestRelatedRun?.startedAt ?? run.startedAt;
}

async function findMatchingResumeCandidateRunId(input: {
  options: IngestionOptions;
  categories: string[];
  announcementDay: string;
}) {
  const from = input.options.from ?? input.announcementDay;
  const to = input.options.to ?? input.announcementDay;
  const run = await prisma.ingestionRun.findFirst({
    where: {
      mode: input.options.mode as IngestionMode,
      status: IngestionStatus.FAILED,
      requestedFrom: new Date(`${from}T00:00:00.000Z`),
      requestedTo: new Date(`${to}T23:59:59.999Z`),
      recomputeScores: Boolean(input.options.recomputeScores),
      recomputeSummaries: Boolean(input.options.recomputeBriefs),
      errorMessage: {
        contains: "no ingest heartbeat",
      },
    },
    orderBy: {
      startedAt: "desc",
    },
    select: {
      id: true,
      categories: true,
      progressJson: true,
    },
  });

  if (!run || !parseIngestionProgress(run.progressJson)) {
    return null;
  }

  const runCategories = parseCategoryList(run.categories) ?? [];
  if (!sameStringSet(runCategories, input.categories)) {
    return null;
  }

  return run.id;
}

async function findActiveIngestionRun() {
  return prisma.ingestionRun.findFirst({
    where: {
      status: IngestionStatus.RUNNING,
    },
    orderBy: {
      startedAt: "desc",
    },
    select: {
      id: true,
      mode: true,
      triggerSource: true,
      startedAt: true,
    },
  });
}

export async function closeStaleIngestionRuns(options?: { now?: Date }) {
  const staleRuns = await findStaleIngestionRuns(options);
  await markStaleIngestionRunsFailed(staleRuns, options);
  return staleRuns.length;
}

export async function recoverStaleIngestionRuns(options?: { now?: Date }) {
  const staleRuns = await findStaleIngestionRuns(options);
  await markStaleIngestionRunsFailed(staleRuns, options);

  let resumedCount = 0;
  for (const run of staleRuns) {
    const resumeOptions = await buildResumeOptions(run);
    if (!resumeOptions) {
      continue;
    }

    const staleFailureCount = await countRecentStaleFailuresForRun(run);
    if (staleFailureCount > MAX_AUTO_RESUME_ATTEMPTS) {
      continue;
    }

    const result = await startIngestionJob(resumeOptions, {
      skipStaleCheck: true,
      startupLogLine: `Auto-resumed after stale ingestion run ${run.id} stopped without a heartbeat. Attempt ${staleFailureCount} of ${MAX_AUTO_RESUME_ATTEMPTS}.`,
    });

    if (result.status === "started") {
      resumedCount += 1;
    }
  }

  return {
    staleCount: staleRuns.length,
    resumedCount,
  };
}

export async function resumeIngestionRun(runId: string) {
  const run = await prisma.ingestionRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      mode: true,
      status: true,
      categories: true,
      requestedFrom: true,
      requestedTo: true,
      recomputeScores: true,
      recomputeSummaries: true,
      progressJson: true,
    },
  });

  if (
    !run ||
    run.status !== IngestionStatus.FAILED ||
    !parseIngestionProgress(run.progressJson)
  ) {
    return {
      status: "not-resumable" as const,
      runId,
    };
  }

  const resumeOptions = await buildResumeOptions(run, TriggerSource.MANUAL);
  if (!resumeOptions) {
    return {
      status: "not-resumable" as const,
      runId,
    };
  }

  return startIngestionJob(resumeOptions, {
    startupLogLine: `Manually resumed failed ingestion run ${run.id} from its checkpoint.`,
  });
}

async function findStaleIngestionRuns(options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  const runningRuns = await prisma.ingestionRun.findMany({
    where: {
      status: IngestionStatus.RUNNING,
    },
    select: {
      id: true,
      startedAt: true,
      mode: true,
      triggerSource: true,
      categories: true,
      requestedFrom: true,
      requestedTo: true,
      recomputeScores: true,
      recomputeSummaries: true,
      logLines: true,
      progressJson: true,
    },
  });
  const staleRuns = runningRuns.flatMap((run) => {
    const progress = parseIngestionProgress(run.progressJson);
    const heartbeatAgeMs = progress?.lastHeartbeatAt
      ? now.getTime() - Date.parse(progress.lastHeartbeatAt)
      : null;
    const startedAgeMs = now.getTime() - run.startedAt.getTime();

    if (
      heartbeatAgeMs !== null &&
      Number.isFinite(heartbeatAgeMs) &&
      heartbeatAgeMs > ACTIVE_HEARTBEAT_STALE_MS
    ) {
      return [
        {
          ...run,
          progress,
          staleMessage:
            "Marked failed automatically after no ingest heartbeat for 5 minutes. The worker may have stopped during a deploy or restart.",
        },
      ];
    }

    if (!progress && startedAgeMs > ACTIVE_MANUAL_RUN_WINDOW_MS) {
      return [
        {
          ...run,
          progress,
          staleMessage:
            "Marked failed automatically after exceeding the 6 hour ingest activity window.",
        },
      ];
    }

    return [];
  });
  return staleRuns;
}

async function markStaleIngestionRunsFailed(
  staleRuns: Awaited<ReturnType<typeof findStaleIngestionRuns>>,
  options?: { now?: Date },
) {
  if (staleRuns.length === 0) {
    return;
  }

  const completedAt = options?.now ?? new Date();
  const completedAtIso = completedAt.toISOString();

  await prisma.$transaction(
    staleRuns.map((run) => {
      const logLines = Array.isArray(run.logLines)
        ? run.logLines
            .filter((line): line is string | number | boolean => line !== null)
            .map((line) => String(line))
        : [];
      if (!logLines.includes(run.staleMessage)) {
        logLines.push(run.staleMessage);
      }

      const progress = run.progress;
      if (progress) {
        const runningPhase =
          progress.phases.find((phase) => phase.status === "running") ??
          (progress.currentPhase
            ? progress.phases.find((phase) => phase.key === progress.currentPhase) ?? null
            : null);

        if (runningPhase) {
          runningPhase.status = "failed";
          runningPhase.completedAt = completedAtIso;
          runningPhase.message = run.staleMessage;
        }

        progress.currentMessage = run.staleMessage;
        progress.lastHeartbeatAt = completedAtIso;
      }

      return prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: IngestionStatus.FAILED,
          completedAt,
          errorMessage: run.staleMessage,
          logLines: toJsonInput(logLines),
          ...(progress ? { progressJson: toJsonInput(progress) } : {}),
        },
      });
    }),
  );
}

type ResumeSourceRun = {
  id: string;
  mode: IngestionMode;
  categories: Prisma.JsonValue;
  requestedFrom: Date | null;
  requestedTo: Date | null;
  recomputeScores: boolean;
  recomputeSummaries: boolean;
};

async function buildResumeOptions(
  run: ResumeSourceRun,
  triggerSource: TriggerSource = TriggerSource.API,
): Promise<IngestionOptions | null> {
  const categories = parseCategoryList(run.categories);
  const from = run.requestedFrom ? toDateOnly(run.requestedFrom) : null;
  const to = run.requestedTo ? toDateOnly(run.requestedTo) : null;

  if (run.mode === IngestionMode.HISTORICAL) {
    if (!from || !to) {
      return null;
    }

    return {
      mode: "HISTORICAL",
      triggerSource,
      categories,
      from,
      to,
      recomputeScores: run.recomputeScores,
      recomputeBriefs: run.recomputeSummaries,
      resumeFromRunId: run.id,
    };
  }

  return {
    mode: "DAILY",
    triggerSource,
    categories,
    announcementDay: from ?? getArxivAnnouncementDateString(),
    recomputeScores: run.recomputeScores,
    recomputeBriefs: run.recomputeSummaries,
    resumeFromRunId: run.id,
  };
}

async function countRecentStaleFailuresForRun(
  run: Awaited<ReturnType<typeof findStaleIngestionRuns>>[number],
) {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return prisma.ingestionRun.count({
    where: {
      mode: run.mode,
      status: IngestionStatus.FAILED,
      requestedFrom: run.requestedFrom,
      requestedTo: run.requestedTo,
      startedAt: {
        gte: windowStart,
      },
      errorMessage: {
        contains: "no ingest heartbeat",
      },
    },
  });
}

function parseCategoryList(value: Prisma.JsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function parseJsonStringList(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function appendHistoricalWarnings(
  logLines: string[],
  result: Omit<HistoricalRecordsResult, "records">,
) {
  const summary =
    result.failedWindows === result.attemptedWindows
      ? `Historical ingestion completed with warnings. All ${result.attemptedWindows} daily windows hit arXiv rate limits or transient API failures, so no historical windows completed successfully.`
      : `Historical ingestion completed with warnings. ${result.failedWindows} of ${result.attemptedWindows} daily windows hit arXiv rate limits or transient API failures.`;

  logLines.push(summary);
  appendEnrichmentWarnings(logLines, result.warnings);
}

async function handleArxivProgressEvent(
  tracker: IngestionProgressReporter,
  event: ArxivProgressEvent,
  mode: IngestionOptions["mode"],
) {
  if (mode !== "DAILY") {
    if (event.type === "wait") {
      await tracker.setWaitingMessage(
        "fetch_historical_window",
        buildArxivWaitMessage(event),
      );
    }
    return;
  }

  if (event.type === "discover-category") {
    await tracker.updatePhase("discover_feeds", {
      processed: event.processedCategories,
      total: event.totalCategories,
      message: `Scanned ${event.processedCategories} of ${event.totalCategories} feeds and found ${event.discoveredCount} candidate papers.`,
      force:
        event.processedCategories === 1 ||
        event.processedCategories === event.totalCategories,
    });
    return;
  }

  if (event.type === "hydrate-batch") {
    await tracker.startPhase("hydrate_arxiv_records", {
      total: event.total,
      processed: 0,
      message: `Hydrating ${event.total} arXiv records.`,
    });
    await tracker.updatePhase("hydrate_arxiv_records", {
      processed: event.processed,
      total: event.total,
      message: `Hydrated ${event.processed} of ${event.total} arXiv records.`,
      force: event.processed === event.total || event.processed === event.batchSize,
    });
    return;
  }

  await tracker.setWaitingMessage("discover_feeds", buildArxivWaitMessage(event));
}

function buildArxivWaitMessage(
  event: Extract<ArxivProgressEvent, { type: "wait" }>,
) {
  const seconds = Math.max(1, Math.ceil(event.delayMs / 1000));
  const laneLabel = event.lane === "api" ? "arXiv API" : "arXiv RSS";
  if (event.reason === "retry-after") {
    return `Waiting on ${laneLabel} rate limit before retry (${seconds}s).`;
  }
  if (event.reason === "retry-backoff") {
    return `Backing off ${laneLabel} after a retryable response (${seconds}s).`;
  }
  return `Respecting ${laneLabel} pacing window (${seconds}s).`;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
      }
    }),
  );

  return results;
}

async function forEachWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<void>,
) {
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await mapper(items[currentIndex]!, currentIndex);
      }
    }),
  );
}

export function toPaperSourceRecord(paper: Paper) {
  return paperToSourceRecord(paper);
}
