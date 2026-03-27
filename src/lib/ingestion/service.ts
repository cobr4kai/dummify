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
  fetchHistoricalRecords,
  type HistoricalRecordsResult,
} from "@/lib/arxiv/backfill";
import { ArxivClient } from "@/lib/arxiv/client";
import { prisma } from "@/lib/db";
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

export async function runIngestionJob(options: IngestionOptions) {
  const appSettings = await getAppSettings();
  const categories = options.categories?.length
    ? options.categories
    : await getEnabledCategoryKeys();
  const arxivClient = new ArxivClient({
    apiMinDelayMs: appSettings.apiMinDelayMs,
    rssMinDelayMs: appSettings.rssMinDelayMs,
    retryBaseDelayMs: appSettings.retryBaseDelayMs,
    apiCacheTtlMinutes: appSettings.apiCacheTtlMinutes,
    feedCacheTtlMinutes: appSettings.feedCacheTtlMinutes,
    cacheRoot: path.resolve(appSettings.pdfCacheDir),
  });
  const announcementDay =
    options.announcementDay ?? getArxivAnnouncementDateString();
  const jobMode = options.jobMode ?? "PRIMARY";

  const run = await prisma.ingestionRun.create({
    data: {
      mode: options.mode as IngestionMode,
      status: IngestionStatus.RUNNING,
      triggerSource: options.triggerSource,
      categories: toJsonInput(categories),
      requestedFrom: options.from ? new Date(`${options.from}T00:00:00.000Z`) : null,
      requestedTo: options.to ? new Date(`${options.to}T23:59:59.999Z`) : null,
      recomputeScores: Boolean(options.recomputeScores),
      recomputeSummaries: Boolean(options.recomputeBriefs),
      logLines: toJsonInput([]),
    },
  });

  const logLines: string[] = [];

  try {
    logLines.push(
      options.mode === "DAILY"
        ? `Starting ${jobMode.toLowerCase()} daily ingestion for the operator brief.`
        : "Starting historical ingestion for the operator brief.",
    );

    let historicalResult: HistoricalRecordsResult | null = null;
    const papers =
      options.mode === "DAILY"
        ? await arxivClient.fetchDaily(categories, announcementDay)
        : (historicalResult = await fetchHistoricalRecords({
            client: arxivClient,
            categories,
            from: options.from!,
            to: options.to!,
          })).records;

    logLines.push(`Fetched ${papers.length} paper records from arXiv.`);
    if (
      options.mode === "DAILY" &&
      papers.length === 0 &&
      isExpectedQuietAnnouncementDay(announcementDay)
    ) {
      logLines.push(
        "No new announcements were expected for this Friday/Saturday arXiv quiet day.",
      );
    }
    if (options.mode === "HISTORICAL" && papers.length === 0) {
      logLines.push("No arXiv records were found in the requested historical window.");
    }
    if (historicalResult?.warnings.length) {
      appendHistoricalWarnings(logLines, historicalResult);
    }

    const upsertedRecords: Array<{ id: string; sourceRecord: PaperSourceRecord }> = [];
    for (const paper of papers) {
      const record = await prisma.$transaction(async (tx) => upsertPaper(tx, paper));
      upsertedRecords.push({
        id: record.id,
        sourceRecord: paper,
      });
    }

    const upsertedIds = upsertedRecords.map((record) => record.id);
    let briefCount = 0;
    const briefProvider = getTechnicalBriefProvider();
    const paperIdsForBriefs = briefProvider
      ? await resolvePaperIdsForBriefs({
          mode: options.mode,
          announcementDay,
        })
      : [];

    if (briefProvider) {
      for (const paperId of paperIdsForBriefs) {
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
      }
    } else {
      logLines.push("Skipped executive briefs because OPENAI_API_KEY is not configured.");
    }

    const enrichmentResults = await mapWithConcurrency(
      upsertedRecords,
      ENRICHMENT_CONCURRENCY,
      async (record) => ({
        paperId: record.id,
        sourceRecord: record.sourceRecord,
        result: await hydratePaperEnrichments(record.id, { force: false }),
      }),
    );

    const structuredMetadataCount = enrichmentResults.filter(({ result }) =>
      result.updatedProviders.includes(STRUCTURED_METADATA_PROVIDER),
    ).length;
    if (structuredMetadataCount > 0) {
      logLines.push(
        `Hydrated structured metadata for ${structuredMetadataCount} papers during ingestion.`,
      );
    }
    appendEnrichmentWarnings(
      logLines,
      enrichmentResults.flatMap(({ paperId, result }) =>
        result.warnings.map((warning) => `Paper ${paperId}: ${warning}`),
      ),
    );

    let scoreCount = 0;
    for (const record of upsertedRecords) {
      const hydration = enrichmentResults.find((item) => item.paperId === record.id)?.result;
      const shouldScore =
        Boolean(options.recomputeScores) ||
        hydration?.updatedProviders.includes(STRUCTURED_METADATA_PROVIDER) ||
        !(await hasCurrentScore(record.id));

      if (!shouldScore) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await replaceCurrentScore(
          tx,
          record.id,
          record.sourceRecord,
          appSettings.genAiRankingWeights,
          hydration?.structuredMetadata ?? null,
        );
      });
      scoreCount += 1;
    }

    const status =
      historicalResult?.warnings.length
        ? IngestionStatus.PARTIAL
        : options.mode === "DAILY" &&
            papers.length === 0 &&
            !isExpectedQuietAnnouncementDay(announcementDay)
          ? IngestionStatus.PARTIAL
          : IngestionStatus.COMPLETED;

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status,
        fetchedCount: papers.length,
        upsertedCount: upsertedIds.length,
        scoreCount,
        summaryCount: briefCount,
        completedAt: new Date(),
        logLines: toJsonInput(logLines),
      },
    });

    return {
      runId: run.id,
      status,
      fetchedCount: papers.length,
      upsertedCount: upsertedIds.length,
      scoreCount,
      summaryCount: briefCount,
      briefCount,
    };
  } catch (error) {
    logLines.push(error instanceof Error ? error.message : "Unknown ingestion failure.");

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
  const run = await prisma.ingestionRun.findFirst({
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

  if (!run) {
    return null;
  }

  const now = options?.now ?? new Date();
  const ageMs = now.getTime() - run.startedAt.getTime();
  return ageMs <= ACTIVE_MANUAL_RUN_WINDOW_MS ? run : null;
}

function appendHistoricalWarnings(
  logLines: string[],
  result: HistoricalRecordsResult,
) {
  const summary =
    result.failedWindows === result.attemptedWindows
      ? `Historical ingestion completed with warnings. All ${result.attemptedWindows} daily windows hit arXiv rate limits or transient API failures, so no historical windows completed successfully.`
      : `Historical ingestion completed with warnings. ${result.failedWindows} of ${result.attemptedWindows} daily windows hit arXiv rate limits or transient API failures.`;

  logLines.push(summary);
  appendEnrichmentWarnings(logLines, result.warnings);
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

export function toPaperSourceRecord(paper: Paper) {
  return paperToSourceRecord(paper);
}
