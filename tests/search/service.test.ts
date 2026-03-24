import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAppSettingsMock,
  getCategoryConfigsMock,
  getPublishedPaperIdsForWeekMock,
  mockData,
} = vi.hoisted(() => ({
  getAppSettingsMock: vi.fn(),
  getCategoryConfigsMock: vi.fn(),
  getPublishedPaperIdsForWeekMock: vi.fn(),
  mockData: {
    papers: [
      {
        id: "paper-1",
        announcementDay: "2026-03-02",
        publishedAt: new Date("2026-03-02T15:00:00.000Z"),
        title: "Week One Lead",
        authorsText: "A. Author",
        abstractUrl: "https://arxiv.org/abs/1",
        primaryCategory: "cs.AI",
        categoryText: "cs.AI",
        isDemoData: false,
        scores: [{ totalScore: 91, rationale: "Strong", breakdown: {} }],
        technicalBriefs: [{ isCurrent: true, usedFallbackAbstract: false }],
        pdfCaches: [{ isCurrent: true }],
        enrichments: [],
      },
      {
        id: "paper-2",
        announcementDay: "2026-03-04",
        publishedAt: new Date("2026-03-04T15:00:00.000Z"),
        title: "Week One Follow-up",
        authorsText: "B. Author",
        abstractUrl: "https://arxiv.org/abs/2",
        primaryCategory: "cs.LG",
        categoryText: "cs.LG",
        isDemoData: false,
        scores: [{ totalScore: 84, rationale: "Solid", breakdown: {} }],
        technicalBriefs: [{ isCurrent: true, usedFallbackAbstract: false }],
        pdfCaches: [{ isCurrent: true }],
        enrichments: [],
      },
      {
        id: "paper-3",
        announcementDay: "2026-03-10",
        publishedAt: new Date("2026-03-10T15:00:00.000Z"),
        title: "Current Week Breakout",
        authorsText: "C. Author",
        abstractUrl: "https://arxiv.org/abs/3",
        primaryCategory: "cs.AI",
        categoryText: "cs.AI",
        isDemoData: false,
        scores: [{ totalScore: 95, rationale: "Top", breakdown: {} }],
        technicalBriefs: [{ isCurrent: true, usedFallbackAbstract: false }],
        pdfCaches: [{ isCurrent: true }],
        enrichments: [],
      },
      {
        id: "paper-4",
        announcementDay: "2026-03-12",
        publishedAt: new Date("2026-03-12T15:00:00.000Z"),
        title: "Current Week Builder",
        authorsText: "D. Author",
        abstractUrl: "https://arxiv.org/abs/4",
        primaryCategory: "cs.CL",
        categoryText: "cs.CL",
        isDemoData: false,
        scores: [{ totalScore: 79, rationale: "Useful", breakdown: {} }],
        technicalBriefs: [{ isCurrent: true, usedFallbackAbstract: false }],
        pdfCaches: [{ isCurrent: true }],
        enrichments: [],
      },
    ],
    runs: [
      {
        id: "run-1",
        status: "COMPLETED",
        mode: "DAILY",
        triggerSource: "MANUAL",
        startedAt: new Date("2026-03-13T18:00:00.000Z"),
        fetchedCount: 2,
        upsertedCount: 2,
        summaryCount: 1,
        logLines: [],
      },
    ],
    publishedByWeek: new Map<string, string[]>([
      ["2026-03-02", ["paper-1", "paper-2"]],
      ["2026-03-09", ["paper-3"]],
    ]),
  },
}));

vi.mock("@/lib/settings/service", () => ({
  getAppSettings: getAppSettingsMock,
  getCategoryConfigs: getCategoryConfigsMock,
}));

vi.mock("@/lib/publishing/service", () => ({
  getPublishedPaperIdsForWeek: getPublishedPaperIdsForWeekMock,
}));

vi.mock("@/lib/db", () => {
  function matchesPaperWhere(paper: (typeof mockData.papers)[number], where: Record<string, unknown>) {
    if (typeof where.isDemoData === "boolean" && paper.isDemoData !== where.isDemoData) {
      return false;
    }

    if ("id" in where) {
      const idClause = where.id as { in?: string[] };
      if (Array.isArray(idClause?.in) && !idClause.in.includes(paper.id)) {
        return false;
      }
    }

    if ("announcementDay" in where) {
      const clause = where.announcementDay as string | { gte?: string; lte?: string; not?: string };
      if (typeof clause === "string") {
        if (paper.announcementDay !== clause) {
          return false;
        }
      } else {
        if (clause.gte && paper.announcementDay < clause.gte) {
          return false;
        }
        if (clause.lte && paper.announcementDay > clause.lte) {
          return false;
        }
        if (clause.not && paper.announcementDay === clause.not) {
          return false;
        }
      }
    }

    if ("technicalBriefs" in where) {
      const briefWhere = where.technicalBriefs as {
        some?: { isCurrent?: boolean; usedFallbackAbstract?: boolean };
      };
      if (briefWhere.some) {
        const matched = paper.technicalBriefs.some((brief) => (
          (briefWhere.some?.isCurrent === undefined || brief.isCurrent === briefWhere.some.isCurrent) &&
          (briefWhere.some?.usedFallbackAbstract === undefined ||
            brief.usedFallbackAbstract === briefWhere.some.usedFallbackAbstract)
        ));
        if (!matched) {
          return false;
        }
      }
    }

    if ("searchText" in where) {
      const clause = where.searchText as { contains?: string };
      if (clause.contains && !paper.title.toLowerCase().includes(clause.contains)) {
        return false;
      }
    }

    if ("NOT" in where) {
      const notClause = where.NOT as Record<string, unknown>;
      if (matchesPaperWhere(paper, notClause)) {
        return false;
      }
    }

    if ("AND" in where) {
      const andClauses = (where.AND as Array<Record<string, unknown>>).filter(Boolean);
      if (!andClauses.every((clause) => matchesPaperWhere(paper, clause))) {
        return false;
      }
    }

    return true;
  }

  function applyPaperQuery(args: Record<string, unknown> = {}) {
    let papers = [...mockData.papers];
    if (args.where) {
      papers = papers.filter((paper) => matchesPaperWhere(paper, args.where as Record<string, unknown>));
    }

    if (args.orderBy) {
      const orderBy = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
      papers.sort((left, right) => {
        for (const clause of orderBy) {
          const [key, direction] = Object.entries(clause as Record<string, "asc" | "desc">)[0];
          const leftValue = left[key as keyof typeof left];
          const rightValue = right[key as keyof typeof right];
          if (leftValue === rightValue) {
            continue;
          }

          const comparison = leftValue > rightValue ? 1 : -1;
          return direction === "asc" ? comparison : comparison * -1;
        }

        return 0;
      });
    }

    if (args.distinct && (args.distinct as string[]).includes("announcementDay")) {
      const seen = new Set<string>();
      papers = papers.filter((paper) => {
        if (seen.has(paper.announcementDay)) {
          return false;
        }
        seen.add(paper.announcementDay);
        return true;
      });
    }

    if (typeof args.take === "number") {
      papers = papers.slice(0, args.take as number);
    }

    if (args.select) {
      const select = args.select as Record<string, boolean>;
      return papers.map((paper) =>
        Object.fromEntries(
          Object.entries(select)
            .filter(([, enabled]) => enabled)
            .map(([key]) => [key, paper[key as keyof typeof paper]]),
        ),
      );
    }

    return papers;
  }

  return {
    prisma: {
      paper: {
        findFirst: vi.fn(async (args: Record<string, unknown>) => {
          const result = applyPaperQuery({ ...args, take: 1 });
          return result[0] ?? null;
        }),
        findMany: vi.fn(async (args: Record<string, unknown>) => applyPaperQuery(args)),
        findUnique: vi.fn(async ({ where }: Record<string, unknown>) =>
          mockData.papers.find((paper) => paper.id === (where as { id: string }).id) ?? null
        ),
      },
      ingestionRun: {
        findMany: vi.fn(async () => mockData.runs),
      },
      paperTechnicalBrief: {
        count: vi.fn(async () =>
          mockData.papers.reduce((count, paper) => count + paper.technicalBriefs.length, 0)
        ),
      },
      paperPdfCache: {
        count: vi.fn(async () =>
          mockData.papers.reduce((count, paper) => count + paper.pdfCaches.length, 0)
        ),
      },
      paperScore: {
        count: vi.fn(async ({ where }: Record<string, unknown>) => {
          const scoringVersion = (where as { scoringVersion?: string; NOT?: { scoringVersion?: string } })
            .scoringVersion;
          const excludedVersion = (where as { NOT?: { scoringVersion?: string } }).NOT
            ?.scoringVersion;

          return mockData.papers.reduce((count, paper) => {
            const score = paper.scores[0];
            if (!score) {
              return count;
            }

            const scoreVersion = "2026-03-22.v4";
            if (scoringVersion && scoreVersion !== scoringVersion) {
              return count;
            }
            if (excludedVersion && scoreVersion === excludedVersion) {
              return count;
            }

            return count + 1;
          }, 0);
        }),
      },
    },
  };
});

import {
  getAdminSnapshot,
  getArchiveResults,
  getLatestCompletedAnnouncementDay,
  getWeeklyBrief,
} from "@/lib/search/service";

describe("weekly search service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T18:00:00.000Z"));

    getAppSettingsMock.mockReset();
    getCategoryConfigsMock.mockReset();
    getPublishedPaperIdsForWeekMock.mockReset();

    getAppSettingsMock.mockResolvedValue({
      activeHomepageAnnouncementDay: null,
      highBusinessRelevanceThreshold: 70,
    });
    getCategoryConfigsMock.mockResolvedValue([
      { key: "cs.AI", label: "AI" },
      { key: "cs.LG", label: "ML" },
    ]);
    getPublishedPaperIdsForWeekMock.mockImplementation(async (weekStart: string) =>
      mockData.publishedByWeek.get(weekStart) ?? []
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves the latest completed announcement day outside the in-progress week", async () => {
    await expect(getLatestCompletedAnnouncementDay()).resolves.toBe("2026-03-04");
  });

  it("builds the homepage from the latest completed curated week by default", async () => {
    const result = await getWeeklyBrief({ category: "all", sort: "score" });

    expect(result.weekStart).toBe("2026-03-02");
    expect(result.weekEnd).toBe("2026-03-08");
    expect(result.weekLabel).toBe("Week of Mar 2, 2026");
    expect(result.papers.map((paper) => paper.id)).toEqual(["paper-1", "paper-2"]);
  });

  it("supports archive week filtering from a legacy day selection", async () => {
    const result = await getArchiveResults({
      announcementDay: "2026-03-13",
      sort: "date",
    });

    expect(result.papers.map((paper) => paper.id)).toEqual(["paper-4", "paper-3"]);
    expect(result.weeks).toEqual(["2026-03-09"]);
  });

  it("aggregates admin snapshot data by week while keeping a separate active homepage week", async () => {
    const snapshot = await getAdminSnapshot({
      weekStart: "2026-03-09",
    });

    expect(snapshot.weeks).toEqual(["2026-03-09", "2026-03-02"]);
    expect(snapshot.selectedWeek).toBe("2026-03-09");
    expect(snapshot.activeHomepageWeekStart).toBe("2026-03-02");
    expect(snapshot.publishedPaperIds).toEqual(["paper-3"]);
    expect(snapshot.activeHomepagePaperIds).toEqual(["paper-1", "paper-2"]);
  });
});
