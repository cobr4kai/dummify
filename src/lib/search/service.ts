import { BriefMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPublishedPaperIdsForDay } from "@/lib/publishing/service";
import { getAppSettings, getCategoryConfigs, type AppSettings } from "@/lib/settings/service";
import { hasPdfBackedBrief } from "@/lib/technical/brief-status";
import { normalizeSearchText } from "@/lib/utils/strings";

export type SortMode = "score" | "date";

export async function getLatestAnnouncementDay() {
  const latest = await prisma.paper.findFirst({
    orderBy: [{ announcementDay: "desc" }, { publishedAt: "desc" }],
    select: { announcementDay: true },
  });

  return latest?.announcementDay ?? null;
}

export async function getAnnouncementDays(limit = 90) {
  const days = await prisma.paper.findMany({
    select: { announcementDay: true },
    distinct: ["announcementDay"],
    orderBy: { announcementDay: "desc" },
    take: limit,
  });

  return days.map((day) => day.announcementDay);
}

async function getArchiveAnnouncementDays(limit = 90) {
  const activeHomepageAnnouncementDay = await resolveActiveHomepageAnnouncementDay();
  const days = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      technicalBriefs: {
        some: {
          isCurrent: true,
          usedFallbackAbstract: false,
        },
      },
      ...(activeHomepageAnnouncementDay
        ? {
            announcementDay: {
              not: activeHomepageAnnouncementDay,
            },
          }
        : {}),
    },
    select: { announcementDay: true },
    distinct: ["announcementDay"],
    orderBy: { announcementDay: "desc" },
    take: limit,
  });

  return days.map((day) => day.announcementDay);
}

export async function resolveActiveHomepageAnnouncementDay(options?: {
  settings?: AppSettings;
  latestDay?: string | null;
}) {
  const settings = options?.settings ?? (await getAppSettings());
  const latestDay = options?.latestDay ?? (await getLatestAnnouncementDay());
  const configuredDay = settings.activeHomepageAnnouncementDay;

  if (!configuredDay) {
    return latestDay;
  }

  const existingPaper = await prisma.paper.findFirst({
    where: { announcementDay: configuredDay },
    select: { id: true },
  });

  return existingPaper ? configuredDay : latestDay;
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

async function getEditionDataForDay(announcementDay: string) {
  const [publishedPaperIds, editionPapers] = await Promise.all([
    getPublishedPaperIdsForDay(announcementDay),
    prisma.paper.findMany({
      where: {
        announcementDay,
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
    }),
  ]);

  return {
    publishedPaperIds,
    editionPapers: sortEditionPapers(editionPapers),
  };
}

export async function getDailyBrief(options: {
  announcementDay?: string | null;
  category?: string | "all";
  sort?: SortMode;
}) {
  const settings = await getAppSettings();
  const latestDay = await getLatestAnnouncementDay();
  const announcementDay =
    options.announcementDay ??
    (await resolveActiveHomepageAnnouncementDay({ settings, latestDay }));

  if (!announcementDay) {
    return {
      papers: [],
      categories: await getCategoryConfigs(),
      announcementDay: null,
      isCurated: false,
      settings,
    };
  }

  const category = options.category ?? "all";
  const sort = options.sort ?? "score";
  const publishedPaperIds = await getPublishedPaperIdsForDay(announcementDay);

  if (publishedPaperIds.length === 0) {
    return {
      papers: [],
      categories: await getCategoryConfigs(),
      announcementDay,
      isCurated: false,
      settings,
    };
  }

  const papers = await prisma.paper.findMany({
    where: {
      announcementDay,
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

  const filtered = papers
    .sort((left, right) => {
      const leftScore = left.scores[0]?.totalScore ?? 0;
      const rightScore = right.scores[0]?.totalScore ?? 0;

      if (sort === "date") {
        return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
      }

      return rightScore - leftScore;
    });

  return {
    papers: filtered,
    categories: await getCategoryConfigs(),
    announcementDay,
    isCurated: true,
    settings,
  };
}

export async function getArchiveResults(options: {
  search?: string;
  announcementDay?: string | "all";
  category?: string | "all";
  sort?: SortMode;
  highSignalOnly?: boolean;
}) {
  const settings = await getAppSettings();
  const activeHomepageAnnouncementDay = await resolveActiveHomepageAnnouncementDay({ settings });
  const search = options.search?.trim() ?? "";
  const category = options.category ?? "all";
  const announcementDay = options.announcementDay ?? "all";
  const sort = options.sort ?? "score";

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
        ...(activeHomepageAnnouncementDay
          ? [{
              announcementDay: {
                not: activeHomepageAnnouncementDay,
              },
            }]
          : []),
        ...(announcementDay !== "all" ? [{ announcementDay }] : []),
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
    days: await getArchiveAnnouncementDays(),
    settings,
  };
}

export async function getPaperDetail(paperId: string) {
  return prisma.paper.findUnique({
    where: { id: paperId },
    include: {
      scores: {
        where: {
          isCurrent: true,
          mode: BriefMode.GENAI,
        },
      },
      technicalBriefs: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      pdfCaches: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      enrichments: {
        where: { isCurrent: true },
      },
    },
  });
}

export async function getAdminSnapshot(options?: {
  announcementDay?: string | null;
}) {
  const [settings, categories, runs, latestDay, days] = await Promise.all([
    getAppSettings(),
    getCategoryConfigs(),
    prisma.ingestionRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    getLatestAnnouncementDay(),
    getAnnouncementDays(),
  ]);

  const activeHomepageAnnouncementDay = await resolveActiveHomepageAnnouncementDay({
    settings,
    latestDay,
  });
  const selectedDay = options?.announcementDay ?? activeHomepageAnnouncementDay ?? latestDay;

  const technicalBriefCount = await prisma.paperTechnicalBrief.count({
    where: { isCurrent: true },
  });

  const pdfCacheCount = await prisma.paperPdfCache.count({
    where: { isCurrent: true },
  });

  const selectedEdition = selectedDay ? await getEditionDataForDay(selectedDay) : null;
  const activeEdition =
    activeHomepageAnnouncementDay && activeHomepageAnnouncementDay !== selectedDay
      ? await getEditionDataForDay(activeHomepageAnnouncementDay)
      : selectedEdition;
  const activeHomepageSnapshot = activeEdition
    ? buildHomepageSnapshot(
        activeEdition.editionPapers,
        activeEdition.publishedPaperIds,
      )
    : {
        homepagePaperIds: [],
        homepageBriefReadyCount: 0,
        homepageMissingBriefCount: 0,
        isCurated: false,
      };

  return {
    settings,
    categories,
    runs,
    latestDay,
    days,
    selectedDay,
    activeHomepageAnnouncementDay,
    publishedPaperIds: selectedEdition?.publishedPaperIds ?? [],
    publishedCount: selectedEdition?.publishedPaperIds.length ?? 0,
    editionPapers: selectedEdition?.editionPapers ?? [],
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
