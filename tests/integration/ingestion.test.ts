import { beforeEach, describe, expect, it, vi } from "vitest";
import { IngestionMode, IngestionStatus, TriggerSource } from "@prisma/client";
import { DEFAULT_GENAI_RANKING_WEIGHTS } from "@/config/defaults";
import { createInitialIngestionProgress } from "@/lib/ingestion/progress-shared";
import { demoPaperFixtures } from "../../data/mock/demo-fixtures";

const {
  dbState,
  fetchDailyMock,
  fetchHistoricalMock,
  getAppSettingsMock,
  getEnabledCategoryKeysMock,
  getEnrichmentProvidersMock,
  getTechnicalBriefProviderMock,
} = vi.hoisted(() => ({
  dbState: {
    nextPaperId: 1,
    nextRunId: 1,
    nextScoreId: 1,
    nextEnrichmentId: 1,
    runs: [] as Array<Record<string, unknown>>,
    papers: new Map<string, Record<string, unknown>>(),
    enrichments: [] as Array<Record<string, unknown>>,
    scores: [] as Array<Record<string, unknown>>,
  },
  fetchDailyMock: vi.fn(),
  fetchHistoricalMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
  getEnabledCategoryKeysMock: vi.fn(),
  getEnrichmentProvidersMock: vi.fn(),
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
  getEnrichmentProviders: getEnrichmentProvidersMock,
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
          technicalBriefs: [],
          publishedItems: [],
          ...(create as Record<string, unknown>),
        };
        dbState.papers.set(arxivId, nextRecord);
        return nextRecord;
      }),
    },
    paperEnrichment: {
      updateMany: vi.fn(async ({ where, data }: Record<string, unknown>) => {
        for (const enrichment of dbState.enrichments) {
          if (
            enrichment.paperId === (where as { paperId: string }).paperId &&
            enrichment.provider === (where as { provider: string }).provider &&
            enrichment.isCurrent === true
          ) {
            Object.assign(enrichment, data);
          }
        }

        return { count: 1 };
      }),
      create: vi.fn(async ({ data }: Record<string, unknown>) => {
        const enrichment = {
          id: `enrichment-${dbState.nextEnrichmentId++}`,
          isCurrent: true,
          ...(data as Record<string, unknown>),
        };
        dbState.enrichments.push(enrichment);
        return enrichment;
      }),
    },
    paperScore: {
      updateMany: vi.fn(async ({ where, data }: Record<string, unknown>) => {
        for (const score of dbState.scores) {
          if (
            score.paperId === (where as { paperId: string }).paperId &&
            score.isCurrent === true &&
            score.mode === (where as { mode: string }).mode
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
            startedAt: new Date(),
            ...(data as Record<string, unknown>),
          };
          dbState.runs.push(run);
          return run;
        }),
        findMany: vi.fn(async () => dbState.runs),
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
      paper: {
        findUnique: vi.fn(async ({ where }: Record<string, unknown>) => {
          const id = (where as { id: string }).id;
          const paper = Array.from(dbState.papers.values()).find((item) => item.id === id);
          if (!paper) {
            return null;
          }

          return {
            ...paper,
            technicalBriefs: paper.technicalBriefs ?? [],
            publishedItems: paper.publishedItems ?? [],
            enrichments: dbState.enrichments.filter(
              (enrichment) => enrichment.paperId === id && enrichment.isCurrent !== false,
            ),
          };
        }),
        findMany: vi.fn(async ({ where }: Record<string, unknown>) => {
          return Array.from(dbState.papers.values()).filter((paper) => {
            if ((where as { isDemoData?: boolean }).isDemoData === false && paper.isDemoData) {
              return false;
            }
            if ((where as { id?: { in?: string[] } }).id?.in) {
              return (where as { id: { in: string[] } }).id.in.includes(String(paper.id));
            }
            const announcementDayFilter = (where as {
              announcementDay?: { gte?: string; lte?: string };
            }).announcementDay;
            if (announcementDayFilter?.gte && String(paper.announcementDay) < announcementDayFilter.gte) {
              return false;
            }
            if (announcementDayFilter?.lte && String(paper.announcementDay) > announcementDayFilter.lte) {
              return false;
            }
            return true;
          });
        }),
        update: vi.fn(async ({ where, data }: Record<string, unknown>) => {
          const id = (where as { id: string }).id;
          const entry = Array.from(dbState.papers.entries()).find(
            ([, paper]) => paper.id === id,
          );
          if (!entry) {
            throw new Error("Missing paper in test double.");
          }

          const [arxivId, paper] = entry;
          const nextRecord = {
            ...paper,
            ...(data as Record<string, unknown>),
          };
          dbState.papers.set(arxivId, nextRecord);
          return nextRecord;
        }),
      },
      paperScore: {
        count: vi.fn(async ({ where }: Record<string, unknown>) => {
          return dbState.scores.filter(
            (score) =>
              score.paperId === (where as { paperId: string }).paperId &&
              score.mode === (where as { mode: string }).mode &&
              score.isCurrent === true,
          ).length;
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

import { closeStaleIngestionRuns, runIngestionJob } from "@/lib/ingestion/service";

describe("runIngestionJob", () => {
  beforeEach(() => {
    dbState.nextPaperId = 1;
    dbState.nextRunId = 1;
    dbState.nextScoreId = 1;
    dbState.nextEnrichmentId = 1;
    dbState.runs.length = 0;
    dbState.papers.clear();
    dbState.enrichments.length = 0;
    dbState.scores.length = 0;

    fetchDailyMock.mockReset();
    fetchHistoricalMock.mockReset();
    getAppSettingsMock.mockReset();
    getEnabledCategoryKeysMock.mockReset();
    getEnrichmentProvidersMock.mockReset();
    getTechnicalBriefProviderMock.mockReset();

    fetchDailyMock.mockResolvedValue([demoPaperFixtures[0].paper]);
    fetchHistoricalMock.mockResolvedValue({
      records: [demoPaperFixtures[0].paper],
      warnings: [],
    });
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
      rssMinDelayMs: 3100,
      apiMinDelayMs: 3100,
      retryBaseDelayMs: 800,
      feedCacheTtlMinutes: 60,
      apiCacheTtlMinutes: 180,
      pdfFetchMode: "personal-research-cache",
      pdfFallbackRetryCooldownMinutes: 180,
    });
    getEnabledCategoryKeysMock.mockResolvedValue(["cs.AI"]);
    getEnrichmentProvidersMock.mockReturnValue([
      {
        provider: "structured_metadata_v1",
        isAvailable: () => true,
        enrich: vi.fn(async () => ({
          provider: "structured_metadata_v1",
          providerRecordId: null,
          payload: {
            version: "structured_metadata_v1",
            sourceBasis: "abstract_only",
            thesis: "A structured thesis for the demo paper.",
            whyItMatters: "This matters for builders tracking deployment-relevant research.",
            topicTags: ["agents", "infra"],
            methodType: "agent system",
            evidenceStrength: "medium",
            likelyAudience: ["builders", "pms"],
            caveats: ["The abstract alone does not prove deployment readiness."],
            noveltyScore: 64,
            businessRelevanceScore: 78,
            searchText: "structured thesis demo paper builders agents infra",
            generationMode: "hybrid",
          },
        })),
      },
    ]);
    getTechnicalBriefProviderMock.mockReturnValue(null);
  });

  it("writes ingestion runs, persists structured metadata, and still scores without executive briefs", async () => {
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
    expect(dbState.enrichments).toHaveLength(1);
    expect(dbState.enrichments[0]).toMatchObject({
      provider: "structured_metadata_v1",
      isCurrent: true,
    });
    expect(String(Array.from(dbState.papers.values())[0]?.searchText)).toContain(
      "structured thesis demo paper builders agents infra",
    );
    expect(dbState.scores).toHaveLength(1);
    expect(dbState.scores[0]?.mode).toBe("GENAI");
    expect(Number(dbState.scores[0]?.totalScore)).toBeGreaterThan(0);
    expect(dbState.runs[0]?.status).toBe("COMPLETED");
    expect(dbState.runs[0]?.logLines).toContain(
      "Skipped executive briefs because OPENAI_API_KEY is not configured.",
    );
    expect(dbState.runs[0]?.logLines).toContain(
      "Hydrated structured metadata for 1 papers during ingestion.",
    );
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

  it("collapses repeated structured metadata fallback warnings into one summary line", async () => {
    fetchDailyMock.mockResolvedValue([
      demoPaperFixtures[0].paper,
      demoPaperFixtures[1].paper,
      demoPaperFixtures[2].paper,
    ]);
    getEnrichmentProvidersMock.mockReturnValue([
      {
        provider: "structured_metadata_v1",
        isAvailable: () => true,
        enrich: vi.fn(async (paper: { arxivId: string }) => ({
          provider: "structured_metadata_v1",
          providerRecordId: null,
          payload: {
            version: "structured_metadata_v1",
            sourceBasis: "abstract_only",
            thesis: "Fallback structured thesis.",
            whyItMatters: "Fallback structured why-it-matters for deterministic mode.",
            topicTags: ["agents"],
            methodType: "system",
            evidenceStrength: "medium",
            likelyAudience: ["builders"],
            caveats: ["Deterministic-only fallback was used."],
            noveltyScore: 50,
            businessRelevanceScore: 55,
            searchText: `fallback metadata ${paper.arxivId}`,
            generationMode: "deterministic_only",
          },
          warnings: [
            "Structured metadata model fallback: 400 Unsupported value: 'temperature' does not support 0.1 with this model. Only the default (1) value is supported.",
          ],
        })),
      },
    ]);

    await runIngestionJob({
      mode: "DAILY",
      triggerSource: TriggerSource.MANUAL,
      announcementDay: "2026-03-11",
    });

    expect(dbState.runs[0]?.logLines).toContain(
      "Structured metadata fell back to deterministic-only for 3 papers: 400 Unsupported value: 'temperature' does not support 0.1 with this model. Only the default (1) value is supported.",
    );
    expect(
      (dbState.runs[0]?.logLines as string[]).filter((line) =>
        line.includes("Structured metadata model fallback:"),
      ),
    ).toHaveLength(0);
  });

  it("marks historical runs partial when some daily windows fail", async () => {
    fetchHistoricalMock
      .mockResolvedValueOnce({
        records: [demoPaperFixtures[0].paper],
        warnings: [],
      })
      .mockResolvedValueOnce({
        records: [],
        warnings: [
          "Historical metadata request for 2026-03-12 to 2026-03-12 stopped at offset 0: arXiv returned 429.",
        ],
      });

    const result = await runIngestionJob({
      mode: "HISTORICAL",
      triggerSource: TriggerSource.MANUAL,
      from: "2026-03-11",
      to: "2026-03-12",
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.fetchedCount).toBe(1);
    expect(dbState.runs[0]?.status).toBe("PARTIAL");
    expect(dbState.runs[0]?.logLines).toContain(
      "Historical ingestion completed with warnings. 1 of 2 daily windows hit arXiv rate limits or transient API failures.",
    );
  });

  it("marks heartbeat-stale running jobs as failed even before the legacy activity window", async () => {
    const progress = createInitialIngestionProgress(IngestionMode.HISTORICAL);
    progress.currentPhase = "fetch_historical_window";
    progress.currentMessage = "Fetching historical window 1 of 7.";
    progress.lastHeartbeatAt = "2026-04-19T07:20:00.000Z";
    progress.phases[1] = {
      ...progress.phases[1],
      status: "running",
      startedAt: "2026-04-19T07:20:00.000Z",
      message: "Fetching historical window 1 of 7.",
    };
    dbState.runs.push({
      id: "stale-run",
      status: IngestionStatus.RUNNING,
      startedAt: new Date("2026-04-19T07:20:00.000Z"),
      logLines: [],
      progressJson: progress,
    });

    const count = await closeStaleIngestionRuns({
      now: new Date("2026-04-19T07:51:00.000Z"),
    });

    expect(count).toBe(1);
    expect(dbState.runs[0]).toMatchObject({
      status: IngestionStatus.FAILED,
      errorMessage:
        "Marked failed automatically after no ingest heartbeat for 30 minutes. The worker may have stopped during a deploy or restart.",
    });
    expect((dbState.runs[0]?.progressJson as typeof progress).currentMessage).toContain(
      "no ingest heartbeat",
    );
    expect((dbState.runs[0]?.progressJson as typeof progress).phases[1]?.status).toBe(
      "failed",
    );
  });

  it("keeps old but heartbeating jobs active", async () => {
    const progress = createInitialIngestionProgress(IngestionMode.HISTORICAL);
    progress.currentPhase = "score_papers";
    progress.lastHeartbeatAt = "2026-04-19T13:55:00.000Z";
    dbState.runs.push({
      id: "active-long-run",
      status: IngestionStatus.RUNNING,
      startedAt: new Date("2026-04-19T07:20:00.000Z"),
      logLines: [],
      progressJson: progress,
    });

    const count = await closeStaleIngestionRuns({
      now: new Date("2026-04-19T14:00:00.000Z"),
    });

    expect(count).toBe(0);
    expect(dbState.runs[0]?.status).toBe(IngestionStatus.RUNNING);
  });
});
