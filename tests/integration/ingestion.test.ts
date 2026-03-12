import { beforeEach, describe, expect, it, vi } from "vitest";
import { TriggerSource } from "@prisma/client";
import { DEFAULT_GENAI_RANKING_WEIGHTS } from "@/config/defaults";
import { demoPaperFixtures } from "../../data/mock/demo-fixtures";

const {
  dbState,
  fetchDailyMock,
  fetchHistoricalMock,
  getAppSettingsMock,
  getEnabledCategoryKeysMock,
  getEnrichmentProviderMock,
  getTechnicalBriefProviderMock,
} = vi.hoisted(() => ({
  dbState: {
    nextPaperId: 1,
    nextRunId: 1,
    nextScoreId: 1,
    runs: [] as Array<Record<string, unknown>>,
    papers: new Map<string, Record<string, unknown>>(),
    scores: [] as Array<Record<string, unknown>>,
  },
  fetchDailyMock: vi.fn(),
  fetchHistoricalMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
  getEnabledCategoryKeysMock: vi.fn(),
  getEnrichmentProviderMock: vi.fn(),
  getTechnicalBriefProviderMock: vi.fn(),
}));

vi.mock("@/lib/arxiv/client", () => ({
  ArxivClient: class ArxivClient {
    fetchDaily = fetchDailyMock;
    fetchHistorical = fetchHistoricalMock;
  },
}));

vi.mock("@/lib/settings/service", () => ({
  getAppSettings: getAppSettingsMock,
  getEnabledCategoryKeys: getEnabledCategoryKeysMock,
}));

vi.mock("@/lib/providers", () => ({
  getEnrichmentProvider: getEnrichmentProviderMock,
  getTechnicalBriefProvider: getTechnicalBriefProviderMock,
}));

vi.mock("@/lib/db", () => {
  const transactionClient = {
    paper: {
      upsert: vi.fn(async ({ where, update, create }: Record<string, unknown>) => {
        const arxivId = (where as { arxivId: string }).arxivId;
        const existing = dbState.papers.get(arxivId);

        if (existing) {
          const nextRecord = {
            ...existing,
            ...(update as Record<string, unknown>),
          };
          dbState.papers.set(arxivId, nextRecord);
          return nextRecord;
        }

        const nextRecord = {
          id: `paper-${dbState.nextPaperId++}`,
          ...(create as Record<string, unknown>),
        };
        dbState.papers.set(arxivId, nextRecord);
        return nextRecord;
      }),
    },
    paperScore: {
      count: vi.fn(async ({ where }: Record<string, unknown>) => {
        const paperId = (where as { paperId: string }).paperId;
        const mode = (where as { mode?: string }).mode;
        return dbState.scores.filter(
          (score) =>
            score.paperId === paperId &&
            score.isCurrent !== false &&
            (mode ? score.mode === mode : true),
        ).length;
      }),
      updateMany: vi.fn(async ({ where, data }: Record<string, unknown>) => {
        const paperId = (where as { paperId: string }).paperId;
        const mode = (where as { mode?: string }).mode;
        for (const score of dbState.scores) {
          if (
            score.paperId === paperId &&
            score.isCurrent !== false &&
            (mode ? score.mode === mode : true)
          ) {
            Object.assign(score, data);
          }
        }

        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: Record<string, unknown>) => {
        const scoreRecord = {
          id: `score-${dbState.nextScoreId++}`,
          isCurrent: true,
          ...(data as Record<string, unknown>),
        };
        dbState.scores.push(scoreRecord);
        return scoreRecord;
      }),
    },
  };

  return {
    prisma: {
      ingestionRun: {
        create: vi.fn(async ({ data }: Record<string, unknown>) => {
          const run = {
            id: `run-${dbState.nextRunId++}`,
            ...(data as Record<string, unknown>),
          };
          dbState.runs.push(run);
          return run;
        }),
        update: vi.fn(async ({ where, data }: Record<string, unknown>) => {
          const run = dbState.runs.find(
            (item) => item.id === (where as { id: string }).id,
          );

          if (!run) {
            throw new Error("Missing ingestion run in test double.");
          }

          Object.assign(run, data);
          return run;
        }),
      },
      $transaction: vi.fn(async (input: unknown) => {
        if (typeof input === "function") {
          return input(transactionClient);
        }

        return Promise.all(input as Promise<unknown>[]);
      }),
    },
  };
});

import { runIngestionJob } from "@/lib/ingestion/service";

describe("runIngestionJob", () => {
  beforeEach(() => {
    dbState.nextPaperId = 1;
    dbState.nextRunId = 1;
    dbState.nextScoreId = 1;
    dbState.runs.length = 0;
    dbState.papers.clear();
    dbState.scores.length = 0;

    fetchDailyMock.mockReset();
    fetchHistoricalMock.mockReset();
    getAppSettingsMock.mockReset();
    getEnabledCategoryKeysMock.mockReset();
    getEnrichmentProviderMock.mockReset();
    getTechnicalBriefProviderMock.mockReset();

    fetchDailyMock.mockResolvedValue([demoPaperFixtures[0].paper]);
    getAppSettingsMock.mockResolvedValue({
      featuredPaperCount: 10,
      genAiFeaturedCount: 10,
      genAiShortlistSize: 25,
      highBusinessRelevanceThreshold: 70,
      audienceFitThreshold: 48,
      rankingWeights: DEFAULT_GENAI_RANKING_WEIGHTS,
      genAiRankingWeights: DEFAULT_GENAI_RANKING_WEIGHTS,
      genAiUsePremiumSynthesis: true,
      pdfCacheDir: ".paperbrief-cache",
      primaryCronSchedule: "15 17 * * 0-4",
      reconcileCronSchedule: "45 20 * * 0-4",
      reconcileEnabled: true,
      rssMinDelayMs: 1000,
      apiMinDelayMs: 3100,
      retryBaseDelayMs: 800,
      feedCacheTtlMinutes: 60,
      apiCacheTtlMinutes: 180,
    });
    getEnabledCategoryKeysMock.mockResolvedValue(["cs.AI"]);
    getEnrichmentProviderMock.mockReturnValue(null);
    getTechnicalBriefProviderMock.mockReturnValue(null);
  });

  it("writes ingestion runs, persists enriched paper metadata, and skips executive briefs without OpenAI", async () => {
    const result = await runIngestionJob({
      mode: "DAILY",
      triggerSource: TriggerSource.MANUAL,
      announcementDay: "2026-03-11",
    });

    expect(result).toMatchObject({
      status: "COMPLETED",
      fetchedCount: 1,
      upsertedCount: 1,
      scoreCount: 1,
      summaryCount: 0,
    });
    expect(Array.from(dbState.papers.values())).toHaveLength(1);
    expect(dbState.scores).toHaveLength(1);
    expect(dbState.scores[0]?.mode).toBe("GENAI");
    expect(Number(dbState.scores[0]?.totalScore)).toBeGreaterThan(0);
    expect(dbState.runs[0]?.status).toBe("COMPLETED");
    expect(dbState.runs[0]?.logLines).toContain(
      "Skipped executive briefs because OPENAI_API_KEY is not configured.",
    );
    expect(Array.from(dbState.papers.values())[0]).toMatchObject({
      versionedId: demoPaperFixtures[0].paper.versionedId,
      sourceFeedCategoriesJson: demoPaperFixtures[0].paper.sourceFeedCategories,
      comment: demoPaperFixtures[0].paper.comment,
      journalRef: demoPaperFixtures[0].paper.journalRef,
      doi: demoPaperFixtures[0].paper.doi,
    });
  });

  it("marks Friday and Saturday zero-paper runs as expected quiet completions", async () => {
    fetchDailyMock.mockResolvedValue([]);

    const result = await runIngestionJob({
      mode: "DAILY",
      triggerSource: TriggerSource.SCHEDULED,
      announcementDay: "2026-03-13",
    });

    expect(result.status).toBe("COMPLETED");
    expect(dbState.runs[0]?.status).toBe("COMPLETED");
    expect(dbState.runs[0]?.logLines).toContain(
      "No new announcements were expected for this Friday/Saturday arXiv quiet day.",
    );
  });

  it("logs reconcile runs separately from the primary daily ingest", async () => {
    await runIngestionJob({
      mode: "DAILY",
      jobMode: "RECONCILE",
      triggerSource: TriggerSource.SCHEDULED,
      announcementDay: "2026-03-11",
    });

    expect(dbState.runs[0]?.logLines).toContain(
      "Starting reconcile daily ingestion for the operator brief.",
    );
  });
});
