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
import { fetchHistoricalRecords } from "@/lib/arxiv/backfill";
import { ArxivClient } from "@/lib/arxiv/client";
import { prisma } from "@/lib/db";
import { paperToSourceRecord, buildPaperSearchText } from "@/lib/papers/record";
import { getEnrichmentProvider, getTechnicalBriefProvider } from "@/lib/providers";
import { getPublishedPaperIdsForDay } from "@/lib/publishing/service";
import { computeBriefScore } from "@/lib/scoring/service";
import { getAppSettings, getEnabledCategoryKeys } from "@/lib/settings/service";
import { ensurePaperTechnicalBrief, selectGenAiTopPaperIds } from "@/lib/technical/service";
import type { PaperSourceRecord } from "@/lib/types";
import { getPacificDateString, isExpectedQuietAnnouncementDay } from "@/lib/utils/dates";
import { toJsonInput } from "@/lib/utils/prisma";

export type DailyJobMode = "PRIMARY" | "RECONCILE";

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
    options.announcementDay ?? getPacificDateString();
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
    const papers =
      options.mode === "DAILY"
        ? await arxivClient.fetchDaily(categories, announcementDay)
        : await fetchHistoricalRecords({
            client: arxivClient,
            categories,
            from: options.from!,
            to: options.to!,
          });

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

    const upsertedIds: string[] = [];
    let scoreCount = 0;

    for (const paper of papers) {
      const outcome = await prisma.$transaction(async (tx) => {
        const record = await upsertPaper(tx, paper);
        upsertedIds.push(record.id);

        const shouldScore =
          options.recomputeScores || !(await hasCurrentScore(tx, record.id));
        if (!shouldScore) {
          return { writtenScores: 0 };
        }

        await replaceCurrentScore(tx, record.id, paper, appSettings.genAiRankingWeights);
        return { writtenScores: 1 };
      });

      scoreCount += outcome.writtenScores;
    }

    let briefCount = 0;
    const briefProvider = getTechnicalBriefProvider();
    const enrichmentProvider = getEnrichmentProvider();

    const shouldSelectBriefTargets =
      briefProvider || enrichmentProvider || options.recomputeBriefs;
    const paperIdsForBriefs = shouldSelectBriefTargets
      ? await resolvePaperIdsForBriefs({
          mode: options.mode,
          announcementDay,
          fallbackPaperIds: upsertedIds,
          shortlistSize: appSettings.genAiShortlistSize,
          featuredCount: appSettings.genAiFeaturedCount,
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

    if (enrichmentProvider) {
      for (const paperId of paperIdsForBriefs) {
        await ensurePaperEnrichment(paperId, { force: true });
      }
    }

    const status =
      papers.length === 0 &&
      !(options.mode === "DAILY" && isExpectedQuietAnnouncementDay(announcementDay))
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
  fallbackPaperIds: string[];
  shortlistSize: number;
  featuredCount: number;
}) {
  if (input.mode === "DAILY") {
    const publishedPaperIds = await getPublishedPaperIdsForDay(input.announcementDay);
    if (publishedPaperIds.length > 0) {
      return publishedPaperIds;
    }
  }

  return selectGenAiTopPaperIds(
    input.fallbackPaperIds,
    input.shortlistSize,
    input.featuredCount,
  );
}

export async function ensurePaperEnrichment(
  paperId: string,
  options: { force?: boolean } = {},
) {
  const provider = getEnrichmentProvider();
  if (!provider) {
    return false;
  }

  if (!options.force) {
    const existing = await prisma.paperEnrichment.findFirst({
      where: {
        paperId,
        provider: provider.provider,
        isCurrent: true,
      },
    });

    if (existing) {
      return false;
    }
  }

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
  });

  if (!paper) {
    return false;
  }

  const enrichment = await provider.enrich(paperToSourceRecord(paper));
  if (!enrichment) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.paperEnrichment.updateMany({
      where: {
        paperId,
        provider: enrichment.provider,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    await tx.paperEnrichment.create({
      data: {
        paperId,
        provider: enrichment.provider,
        providerRecordId: enrichment.providerRecordId,
        payload: toJsonInput(enrichment.payload),
      },
    });
  });

  return true;
}

async function upsertPaper(tx: Prisma.TransactionClient, paper: PaperSourceRecord) {
  const searchText = buildPaperSearchText(paper);

  return tx.paper.upsert({
    where: { arxivId: paper.arxivId },
    update: {
      version: paper.version,
      versionedId: paper.versionedId,
      title: paper.title,
      abstract: paper.abstract,
      authorsJson: toJsonInput(paper.authors),
      authorsText: paper.authors.join(", "),
      categoriesJson: toJsonInput(paper.categories),
      sourceFeedCategoriesJson: toJsonInput(paper.sourceFeedCategories),
      categoryText: paper.categories.join(" "),
      primaryCategory: paper.primaryCategory,
      publishedAt: paper.publishedAt,
      updatedAt: paper.updatedAt,
      announcementDay: paper.announcementDay,
      announceType: paper.announceType,
      comment: paper.comment ?? null,
      journalRef: paper.journalRef ?? null,
      doi: paper.doi ?? null,
      abstractUrl: paper.links.abs,
      pdfUrl: paper.links.pdf,
      links: toJsonInput(paper.links),
      sourceMetadata: toJsonInput(paper.sourceMetadata),
      sourcePayload: toJsonInput(paper.sourcePayload),
      searchText,
      lastSeenAt: new Date(),
      isDemoData: false,
    },
    create: {
      arxivId: paper.arxivId,
      version: paper.version,
      versionedId: paper.versionedId,
      title: paper.title,
      abstract: paper.abstract,
      authorsJson: toJsonInput(paper.authors),
      authorsText: paper.authors.join(", "),
      categoriesJson: toJsonInput(paper.categories),
      sourceFeedCategoriesJson: toJsonInput(paper.sourceFeedCategories),
      categoryText: paper.categories.join(" "),
      primaryCategory: paper.primaryCategory,
      publishedAt: paper.publishedAt,
      updatedAt: paper.updatedAt,
      announcementDay: paper.announcementDay,
      announceType: paper.announceType,
      comment: paper.comment ?? null,
      journalRef: paper.journalRef ?? null,
      doi: paper.doi ?? null,
      abstractUrl: paper.links.abs,
      pdfUrl: paper.links.pdf,
      links: toJsonInput(paper.links),
      sourceMetadata: toJsonInput(paper.sourceMetadata),
      sourcePayload: toJsonInput(paper.sourcePayload),
      searchText,
      isDemoData: false,
    },
  });
}

async function hasCurrentScore(tx: Prisma.TransactionClient, paperId: string) {
  const count = await tx.paperScore.count({
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
) {
  const score = computeBriefScore(paper, rankingWeights);

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

export function toPaperSourceRecord(paper: Paper) {
  return paperToSourceRecord(paper);
}

