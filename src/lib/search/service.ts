import { BriefMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAppSettings, getCategoryConfigs } from "@/lib/settings/service";
import { normalizeSearchText } from "@/lib/utils/strings";

export type SortMode = "score" | "date";

export async function getLatestAnnouncementDay() {
  const latest = await prisma.paper.findFirst({
    orderBy: [{ announcementDay: "desc" }, { publishedAt: "desc" }],
    select: { announcementDay: true },
  });

  return latest?.announcementDay ?? null;
}

export async function getDailyBrief(options: {
  announcementDay?: string | null;
  category?: string | "all";
  sort?: SortMode;
}) {
  const settings = await getAppSettings();
  const announcementDay =
    options.announcementDay ?? (await getLatestAnnouncementDay());

  if (!announcementDay) {
    return {
      papers: [],
      categories: await getCategoryConfigs(),
      announcementDay: null,
      settings,
    };
  }

  const category = options.category ?? "all";
  const sort = options.sort ?? "score";

  const papers = await prisma.paper.findMany({
    where: {
      announcementDay,
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
        where: { isCurrent: true },
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
    })
    .slice(0, settings.genAiFeaturedCount);

  return {
    papers: filtered,
    categories: await getCategoryConfigs(),
    announcementDay,
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
  const search = options.search?.trim() ?? "";
  const category = options.category ?? "all";
  const announcementDay = options.announcementDay ?? "all";
  const sort = options.sort ?? "score";

  const papers = await prisma.paper.findMany({
    where: {
      ...(announcementDay !== "all" ? { announcementDay } : {}),
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

  const days = await prisma.paper.findMany({
    select: { announcementDay: true },
    distinct: ["announcementDay"],
    orderBy: { announcementDay: "desc" },
    take: 90,
  });

  return {
    papers: filtered,
    categories: await getCategoryConfigs(),
    days: days.map((day) => day.announcementDay),
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

export async function getAdminSnapshot() {
  const [settings, categories, runs, latestDay] = await Promise.all([
    getAppSettings(),
    getCategoryConfigs(),
    prisma.ingestionRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    getLatestAnnouncementDay(),
  ]);

  const technicalBriefCount = await prisma.paperTechnicalBrief.count({
    where: { isCurrent: true },
  });

  const pdfCacheCount = await prisma.paperPdfCache.count({
    where: { isCurrent: true },
  });

  return {
    settings,
    categories,
    runs,
    latestDay,
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
