import { BriefMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recoverStaleIngestionRuns } from "@/lib/ingestion/service";
import { normalizeAdminIngestionRun } from "@/lib/ingestion/progress";
import { getPublishedPaperIdsForWeek } from "@/lib/publishing/service";
import { getAppSettings, getCategoryConfigs, type AppSettings } from "@/lib/settings/service";
import { hasPdfBackedBrief } from "@/lib/technical/brief-status";
import {
  formatWeekLabel,
  getCurrentWeekStart,
  getWeekEnd,
  getWeekStart,
  getWeekStarts,
} from "@/lib/utils/dates";
import { normalizeSearchText } from "@/lib/utils/strings";

export type SortMode = "score" | "date";
const ADMIN_EDITION_TABLE_LIMIT = 350;

type EditionWeek = {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
};

export async function getLatestAnnouncementDay() {
  const latest = await prisma.paper.findFirst({
    orderBy: [{ announcementDay: "desc" }, { publishedAt: "desc" }],
    select: { announcementDay: true },
  });

  return latest?.announcementDay ?? null;
}

export async function getLatestCompletedAnnouncementDay(limit = 365) {
  const currentWeekStart = getCurrentWeekStart();
  const days = await getAnnouncementDays(limit);

  return days.find((day) => getWeekStart(day) < currentWeekStart) ?? null;
}

export async function getAnnouncementDays(limit = 365) {
  const days = await prisma.paper.findMany({
    select: { announcementDay: true },
    distinct: ["announcementDay"],
    orderBy: { announcementDay: "desc" },
    take: limit,
  });

  return days.map((day) => day.announcementDay);
}

export async function getAnnouncementWeeks(limit = 52) {
  const days = await getAnnouncementDays(limit * 7);
  return getWeekStarts(days, limit);
}

async function getArchiveAnnouncementWeeks(limit = 52) {
  const activeHomepageWeekStart = await resolveActiveHomepageWeekStart();
  const activeHomepageWeekEnd = activeHomepageWeekStart
    ? getWeekEnd(activeHomepageWeekStart)
    : null;
  const days = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      technicalBriefs: {
        some: {
          isCurrent: true,
          usedFallbackAbstract: false,
        },
      },
      ...(activeHomepageWeekStart && activeHomepageWeekEnd
        ? {
            NOT: {
              announcementDay: {
                gte: activeHomepageWeekStart,
                lte: activeHomepageWeekEnd,
              },
            },
          }
        : {}),
    },
    select: { announcementDay: true },
    distinct: ["announcementDay"],
    orderBy: { announcementDay: "desc" },
    take: limit * 7,
  });

  return getWeekStarts(days.map((day) => day.announcementDay), limit);
}

export async function resolveActiveHomepageWeekStart(options?: {
  settings?: AppSettings;
  latestCompletedDay?: string | null;
}) {
  const settings = options?.settings ?? (await getAppSettings());
  const latestCompletedDay =
    options?.latestCompletedDay ?? (await getLatestCompletedAnnouncementDay());
  const configuredDay = settings.activeHomepageAnnouncementDay;

  if (!configuredDay) {
    return latestCompletedDay ? getWeekStart(latestCompletedDay) : null;
  }

  const configuredWeekStart = getWeekStart(configuredDay);
  const configuredWeekEnd = getWeekEnd(configuredWeekStart);
  const existingPaper = await prisma.paper.findFirst({
    where: {
      announcementDay: {
        gte: configuredWeekStart,
        lte: configuredWeekEnd,
      },
    },
    select: { id: true },
  });

  return existingPaper ? configuredWeekStart : latestCompletedDay ? getWeekStart(latestCompletedDay) : null;
}

function buildEditionWeek(weekStart: string): EditionWeek {
  return {
    weekStart,
    weekEnd: getWeekEnd(weekStart),
    weekLabel: formatWeekLabel(weekStart),
  };
}

function orderPapersByPublishedSequence<T extends { id: string }>(
  papers: T[],
  orderedPaperIds: string[],
) {
  const orderedIndex = new Map(
    orderedPaperIds.map((paperId, index) => [paperId, index]),
  );

  return [...papers].sort((left, right) => {
    const leftIndex = orderedIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderedIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return 0;
  });
}

function sortEditionPapers<
  T extends {
    scores: Array<{
      totalScore: number;
    }>;
  },
>(papers: T[]) {
  return papers.sort(
    (left, right) => (right.scores[0]?.totalScore ?? 0) - (left.scores[0]?.totalScore ?? 0),
  );
}

function buildHomepageSnapshot<
  T extends {
    id: string;
    technicalBriefs: Parameters<typeof hasPdfBackedBrief>[0];
  },
>(papers: T[], publishedPaperIds: string[]) {
  const homepagePaperIds = publishedPaperIds;
  const homepageSet = new Set(homepagePaperIds);
  const homepageBriefReadyCount = papers.filter(
    (paper) => homepageSet.has(paper.id) && hasPdfBackedBrief(paper.technicalBriefs),
  ).length;

  return {
    homepagePaperIds,
    homepageBriefReadyCount,
    homepageMissingBriefCount: Math.max(homepagePaperIds.length - homepageBriefReadyCount, 0),
    isCurated: publishedPaperIds.length > 0,
  };
}

const leanEditionPaperSelect = {
  id: true,
  announcementDay: true,
  title: true,
  authorsText: true,
  abstractUrl: true,
  primaryCategory: true,
  technicalBriefs: {
    where: { isCurrent: true },
    orderBy: { updatedAt: "desc" },
    take: 1,
    select: {
      oneLineVerdict: true,
      usedFallbackAbstract: true,
    },
  },
} as const;

async function getEditionDataForWeek(
  weekStart: string,
  options: {
    offset?: number;
    query?: string | null;
  } = {},
) {
  const weekEnd = getWeekEnd(weekStart);
  const offset = Math.max(0, options.offset ?? 0);
  const rawQuery = options.query?.trim() ?? "";
  const normalizedQuery = normalizeSearchText(rawQuery);
  const paperWhere = {
    announcementDay: {
      gte: weekStart,
      lte: weekEnd,
    },
    isDemoData: false,
    ...(normalizedQuery
      ? {
          OR: [
            { title: { contains: rawQuery } },
            { authorsText: { contains: rawQuery } },
            { searchText: { contains: normalizedQuery } },
          ],
        }
      : {}),
  };
  const [publishedPaperIds, scoredRows, totalScoredCount] = await Promise.all([
    getPublishedPaperIdsForWeek(weekStart),
    prisma.paperScore.findMany({
      where: {
        isCurrent: true,
        mode: BriefMode.GENAI,
        paper: paperWhere,
      },
      orderBy: {
        totalScore: "desc",
      },
      skip: offset,
      take: ADMIN_EDITION_TABLE_LIMIT,
      select: {
        totalScore: true,
        rationale: true,
        breakdown: true,
        paper: {
          select: leanEditionPaperSelect,
        },
      },
    }),
    prisma.paperScore.count({
      where: {
        isCurrent: true,
        mode: BriefMode.GENAI,
        paper: paperWhere,
      },
    }),
  ]);
  const scoredPaperIds = new Set(scoredRows.map((row) => row.paper.id));
  const missingPublishedPaperIds = publishedPaperIds.filter(
    (paperId) => !scoredPaperIds.has(paperId),
  );
  const publishedPapers = missingPublishedPaperIds.length
    ? await prisma.paper.findMany({
        where: {
          id: { in: missingPublishedPaperIds },
        },
        select: {
          ...leanEditionPaperSelect,
          scores: {
            where: {
              isCurrent: true,
              mode: BriefMode.GENAI,
            },
            orderBy: {
              totalScore: "desc",
            },
            take: 1,
            select: {
              totalScore: true,
              rationale: true,
              breakdown: true,
            },
          },
        },
      })
    : [];
  const editionPapers = [
    ...scoredRows.map((row) => ({
      ...row.paper,
      scores: [
        {
          totalScore: row.totalScore,
          rationale: row.rationale,
          breakdown: row.breakdown,
        },
      ],
    })),
    ...publishedPapers,
  ];

  return {
    publishedPaperIds,
    editionPapers: sortEditionPapers(editionPapers),
    totalScoredCount,
    offset,
    query: rawQuery,
    weekEnd,
  };
}

async function getHomepageSnapshotForWeek(weekStart: string) {
  const publishedPaperIds = await getPublishedPaperIdsForWeek(weekStart);
  if (publishedPaperIds.length === 0) {
    return {
      homepagePaperIds: [],
      homepageBriefReadyCount: 0,
      homepageMissingBriefCount: 0,
      isCurated: false,
    };
  }

  const papers = await prisma.paper.findMany({
    where: {
      id: { in: publishedPaperIds },
    },
    select: {
      id: true,
      technicalBriefs: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          usedFallbackAbstract: true,
        },
      },
    },
  });

  return buildHomepageSnapshot(papers, publishedPaperIds);
}

export async function getWeeklyBrief(options: {
  weekStart?: string | null;
  announcementDay?: string | null;
  category?: string | "all";
  sort?: SortMode;
}) {
  const settings = await getAppSettings();
  const latestCompletedDay = await getLatestCompletedAnnouncementDay();
  const resolvedWeekStart =
    options.weekStart ??
    (options.announcementDay ? getWeekStart(options.announcementDay) : null) ??
    (await resolveActiveHomepageWeekStart({ settings, latestCompletedDay }));

  if (!resolvedWeekStart) {
    return {
      papers: [],
      categories: await getCategoryConfigs(),
      weekStart: null,
      weekEnd: null,
      weekLabel: null,
      isCurated: false,
      settings,
    };
  }

  const category = options.category ?? "all";
  const publishedPaperIds = await getPublishedPaperIdsForWeek(resolvedWeekStart);
  const editionWeek = buildEditionWeek(resolvedWeekStart);

  if (publishedPaperIds.length === 0) {
    return {
      papers: [],
      categories: await getCategoryConfigs(),
      ...editionWeek,
      isCurated: false,
      settings,
    };
  }

  const papers = await prisma.paper.findMany({
    where: {
      announcementDay: {
        gte: editionWeek.weekStart,
        lte: editionWeek.weekEnd,
      },
      id: { in: publishedPaperIds },
      ...(category !== "all"
        ? {
            OR: [
              { primaryCategory: category },
              { categoryText: { contains: category } },
            ],
          }
        : {}),
    },
    include: {
      scores: {
        where: {
          isCurrent: true,
          mode: BriefMode.GENAI,
        },
        take: 1,
      },
      technicalBriefs: {
        where: {
          isCurrent: true,
          usedFallbackAbstract: false,
        },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      pdfCaches: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  const filtered = orderPapersByPublishedSequence(papers, publishedPaperIds);

  return {
    papers: filtered,
    categories: await getCategoryConfigs(),
    ...editionWeek,
    isCurated: true,
    settings,
  };
}

export async function getDailyBrief(options: {
  announcementDay?: string | null;
  weekStart?: string | null;
  category?: string | "all";
  sort?: SortMode;
}) {
  return getWeeklyBrief(options);
}

export async function getArchiveResults(options: {
  search?: string;
  week?: string | "all";
  announcementDay?: string | "all";
  category?: string | "all";
  sort?: SortMode;
  highSignalOnly?: boolean;
}) {
  const settings = await getAppSettings();
  const activeHomepageWeekStart = await resolveActiveHomepageWeekStart({ settings });
  const activeHomepageWeekEnd = activeHomepageWeekStart
    ? getWeekEnd(activeHomepageWeekStart)
    : null;
  const search = options.search?.trim() ?? "";
  const category = options.category ?? "all";
  const week =
    options.week ??
    (options.announcementDay && options.announcementDay !== "all"
      ? getWeekStart(options.announcementDay)
      : "all");
  const sort = options.sort ?? "score";
  const selectedWeek = week ?? "all";
  const selectedWeekEnd = selectedWeek !== "all" ? getWeekEnd(selectedWeek) : null;

  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      technicalBriefs: {
        some: {
          isCurrent: true,
          usedFallbackAbstract: false,
        },
      },
      AND: [
        ...(activeHomepageWeekStart && activeHomepageWeekEnd
          ? [{
              NOT: {
                announcementDay: {
                  gte: activeHomepageWeekStart,
                  lte: activeHomepageWeekEnd,
                },
              },
            }]
          : []),
        ...(selectedWeek !== "all" && selectedWeekEnd
          ? [{
              announcementDay: {
                gte: selectedWeek,
                lte: selectedWeekEnd,
              },
            }]
          : []),
      ],
      ...(category !== "all"
        ? {
            OR: [
              { primaryCategory: category },
              { categoryText: { contains: category } },
            ],
          }
        : {}),
      ...(search
        ? {
            searchText: {
              contains: normalizeSearchText(search),
            },
          }
        : {}),
    },
    include: {
      scores: {
        where: {
          isCurrent: true,
          mode: BriefMode.GENAI,
        },
        take: 1,
      },
      technicalBriefs: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  const filtered = papers
    .filter((paper) => {
      const score = paper.scores[0];
      if (!options.highSignalOnly || !score) {
        return true;
      }

      return score.totalScore >= settings.highBusinessRelevanceThreshold;
    })
    .sort((left, right) => {
      if (sort === "date") {
        return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
      }

      return (right.scores[0]?.totalScore ?? 0) - (left.scores[0]?.totalScore ?? 0);
    });

  return {
    papers: filtered,
    categories: await getCategoryConfigs(),
    weeks: await getArchiveAnnouncementWeeks(),
    settings,
  };
}

export async function getPaperDetail(paperId: string) {
  return prisma.paper.findUnique({
    where: { id: paperId },
    select: {
      id: true,
      arxivId: true,
      version: true,
      title: true,
      abstract: true,
      authorsText: true,
      abstractUrl: true,
      primaryCategory: true,
      publishedAt: true,
      updatedAt: true,
      announcementDay: true,
      scores: {
        where: {
          isCurrent: true,
          mode: BriefMode.GENAI,
        },
        select: {
          totalScore: true,
          breakdown: true,
          rationale: true,
        },
      },
      technicalBriefs: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          oneLineVerdict: true,
          keyStatsJson: true,
          affiliationsJson: true,
          focusTagsJson: true,
          whyItMatters: true,
          whatToIgnore: true,
          executiveTakeaway: true,
          bulletsJson: true,
          performanceImpact: true,
          trainingImpact: true,
          inferenceImpact: true,
          limitationsJson: true,
          confidenceNotesJson: true,
          evidenceJson: true,
          provider: true,
          model: true,
          sourceBasis: true,
          usedFallbackAbstract: true,
        },
      },
      pdfCaches: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          extractionStatus: true,
          extractionError: true,
          pageCount: true,
        },
      },
      enrichments: {
        where: { isCurrent: true },
        select: {
          provider: true,
          payload: true,
        },
      },
    },
  });
}

export async function getAdminIngestionStatus() {
  await recoverStaleIngestionRuns();

  const runs = await prisma.ingestionRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  const normalizedRuns = runs.map(normalizeAdminIngestionRun);
  const activeRun = normalizedRuns.find((run) => run.status === "RUNNING") ?? null;

  return {
    activeRun,
    recentRuns: normalizedRuns.filter((run) => run.id !== activeRun?.id),
  };
}

export async function getAdminSnapshot(options?: {
  weekStart?: string | null;
  announcementDay?: string | null;
  includeEditionData?: boolean;
  editionOffset?: number;
  editionQuery?: string | null;
}) {
  const requestedWeekStart =
    options?.weekStart ??
    (options?.announcementDay ? getWeekStart(options.announcementDay) : null);
  const [settings, categories, ingestionStatus, latestDay, latestCompletedDay, days] = await Promise.all([
    getAppSettings(),
    getCategoryConfigs(),
    getAdminIngestionStatus(),
    getLatestAnnouncementDay(),
    getLatestCompletedAnnouncementDay(),
    getAnnouncementDays(),
  ]);

  const weeks = getWeekStarts(days, 52);
  const activeHomepageWeekStart = await resolveActiveHomepageWeekStart({
    settings,
    latestCompletedDay,
  });
  const selectedWeek = requestedWeekStart ?? activeHomepageWeekStart ?? weeks[0] ?? null;

  const technicalBriefCount = await prisma.paperTechnicalBrief.count({
    where: { isCurrent: true },
  });

  const pdfCacheCount = await prisma.paperPdfCache.count({
    where: { isCurrent: true },
  });
  const selectedEdition =
    options?.includeEditionData && selectedWeek
      ? await getEditionDataForWeek(selectedWeek, {
          offset: options.editionOffset,
          query: options.editionQuery,
        })
      : null;
  const activeHomepageSnapshot = activeHomepageWeekStart
    ? await getHomepageSnapshotForWeek(activeHomepageWeekStart)
    : {
        homepagePaperIds: [],
        homepageBriefReadyCount: 0,
        homepageMissingBriefCount: 0,
        isCurated: false,
      };

  return {
    settings,
    categories,
    activeRun: ingestionStatus.activeRun,
    runs: ingestionStatus.recentRuns,
    latestDay,
    latestCompletedWeekStart: latestCompletedDay ? getWeekStart(latestCompletedDay) : null,
    weeks,
    selectedWeek,
    selectedWeekEnd: selectedWeek ? getWeekEnd(selectedWeek) : null,
    selectedWeekLabel: selectedWeek ? formatWeekLabel(selectedWeek) : null,
    activeHomepageWeekStart,
    activeHomepageWeekEnd: activeHomepageWeekStart ? getWeekEnd(activeHomepageWeekStart) : null,
    activeHomepageWeekLabel: activeHomepageWeekStart ? formatWeekLabel(activeHomepageWeekStart) : null,
    publishedPaperIds: selectedEdition?.publishedPaperIds ?? [],
    publishedCount: selectedEdition?.publishedPaperIds.length ?? 0,
    editionPapers: selectedEdition?.editionPapers ?? [],
    editionPaperTotal: selectedEdition?.totalScoredCount ?? 0,
    editionPaperLimit: ADMIN_EDITION_TABLE_LIMIT,
    editionPaperOffset: selectedEdition?.offset ?? 0,
    editionQuery: selectedEdition?.query ?? "",
    activeHomepagePaperIds: activeHomepageSnapshot.homepagePaperIds,
    activeHomepageBriefReadyCount: activeHomepageSnapshot.homepageBriefReadyCount,
    activeHomepageMissingBriefCount: activeHomepageSnapshot.homepageMissingBriefCount,
    activeHomepageIsCurated: activeHomepageSnapshot.isCurated,
    technicalBriefCount,
    pdfCacheCount,
  };
}

export function getCurrentScore<
  T extends {
    totalScore: number;
  },
>(scores: T[]) {
  return scores[0] ?? null;
}
