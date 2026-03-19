import { BriefMode, type Prisma } from "@prisma/client";
import { decodeBriefSlug, getBriefPath, getBriefSlug } from "@/lib/brief-paths";
import { prisma } from "@/lib/db";
import { getPublishedPaperIdsForWeek } from "@/lib/publishing/service";
import { getWeekEnd, getWeekStart } from "@/lib/utils/dates";

export {
  getBriefMetaDescription,
  getBriefPath,
  getBriefSlug,
  getWeekHeading,
  getWeekMetaDescription,
  getWeekPath,
} from "@/lib/brief-paths";

const BRIEF_INCLUDE = {
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
    orderBy: { updatedAt: "desc" as const },
    take: 1,
  },
  pdfCaches: {
    where: { isCurrent: true },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
  },
  enrichments: {
    where: { isCurrent: true },
  },
} satisfies Prisma.PaperInclude;

const BRIEF_LIST_SELECT = {
  id: true,
  arxivId: true,
  title: true,
  authorsText: true,
  abstractUrl: true,
  announcementDay: true,
  publishedAt: true,
  updatedAt: true,
  createdAt: true,
  recordUpdatedAt: true,
  technicalBriefs: {
    where: {
      isCurrent: true,
      usedFallbackAbstract: false,
    },
    orderBy: { updatedAt: "desc" as const },
    take: 1,
    select: {
      updatedAt: true,
    },
  },
} satisfies Prisma.PaperSelect;

export type PublicBriefListItem = Prisma.PaperGetPayload<{
  select: typeof BRIEF_LIST_SELECT;
}>;

export type PublicBrief = Prisma.PaperGetPayload<{
  include: typeof BRIEF_INCLUDE;
}>;

export type PublicWeek = {
  weekStart: string;
  weekEnd: string;
  papers: PublicBrief[];
  lastModified: Date;
};

export async function getPublicBriefByPaperId(paperId: string) {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: BRIEF_INCLUDE,
  });

  if (!paper || paper.technicalBriefs.length === 0) {
    return null;
  }

  return paper;
}

export async function getCanonicalPaperPathById(paperId: string) {
  const paper = await getPublicBriefByPaperId(paperId);
  return paper ? getBriefPath(paper) : `/papers/${paperId}`;
}

export async function getPublicBriefBySlug(slug: string) {
  const arxivId = decodeBriefSlug(slug);
  if (!arxivId) {
    return null;
  }

  const paper = await prisma.paper.findFirst({
    where: {
      arxivId,
      isDemoData: false,
      technicalBriefs: {
        some: {
          isCurrent: true,
          usedFallbackAbstract: false,
        },
      },
    },
    include: BRIEF_INCLUDE,
  });

  if (!paper || paper.technicalBriefs.length === 0) {
    return null;
  }

  return paper;
}

export async function getPublicBriefSlugs() {
  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      technicalBriefs: {
        some: {
          isCurrent: true,
          usedFallbackAbstract: false,
        },
      },
    },
    select: BRIEF_LIST_SELECT,
    orderBy: [{ announcementDay: "desc" }, { publishedAt: "desc" }],
  });

  return papers.map((paper) => ({
    slug: getBriefSlug(paper),
    lastModified: getPaperLastModified(paper),
  }));
}

export async function getPublicBriefsByWeek(weekStart: string) {
  const weekEnd = getWeekEnd(weekStart);
  const [publishedPaperIds, papers] = await Promise.all([
    getPublishedPaperIdsForWeek(weekStart),
    prisma.paper.findMany({
      where: {
        isDemoData: false,
        announcementDay: {
          gte: weekStart,
          lte: weekEnd,
        },
        technicalBriefs: {
          some: {
            isCurrent: true,
            usedFallbackAbstract: false,
          },
        },
      },
      include: BRIEF_INCLUDE,
      orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
    }),
  ]);

  if (papers.length === 0) {
    return null;
  }

  const orderedPapers = orderByPublishedSequence(papers, publishedPaperIds);

  return {
    weekStart,
    weekEnd,
    papers: orderedPapers,
    lastModified: orderedPapers.reduce(
      (latest, paper) =>
        getPaperLastModified(paper).getTime() > latest.getTime()
          ? getPaperLastModified(paper)
          : latest,
      getPaperLastModified(orderedPapers[0]),
    ),
  } satisfies PublicWeek;
}

export async function getPublicWeeks() {
  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      technicalBriefs: {
        some: {
          isCurrent: true,
          usedFallbackAbstract: false,
        },
      },
    },
    select: BRIEF_LIST_SELECT,
    orderBy: [{ announcementDay: "desc" }, { publishedAt: "desc" }],
  });

  const grouped = new Map<
    string,
    {
      items: PublicBriefListItem[];
      lastModified: Date;
    }
  >();

  for (const paper of papers) {
    const weekStart = getWeekStart(paper.announcementDay);
    const lastModified = getPaperLastModified(paper);
    const existing = grouped.get(weekStart);

    if (!existing) {
      grouped.set(weekStart, {
        items: [paper],
        lastModified,
      });
      continue;
    }

    existing.items.push(paper);
    if (lastModified.getTime() > existing.lastModified.getTime()) {
      existing.lastModified = lastModified;
    }
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([weekStart, value]) => ({
      weekStart,
      weekEnd: getWeekEnd(weekStart),
      count: value.items.length,
      lastModified: value.lastModified,
      briefs: value.items.map((paper) => ({
        id: paper.id,
        title: paper.title,
        slug: getBriefSlug(paper),
      })),
    }));
}

export async function getLatestPublicWeek() {
  const weeks = await getPublicWeeks();
  return weeks[0] ?? null;
}

export function getPaperLastModified(
  paper: Pick<PublicBriefListItem, "recordUpdatedAt" | "updatedAt" | "technicalBriefs" | "createdAt">,
) {
  const technicalBriefUpdatedAt = paper.technicalBriefs[0]?.updatedAt;
  return technicalBriefUpdatedAt ?? paper.recordUpdatedAt ?? paper.updatedAt ?? paper.createdAt;
}
function orderByPublishedSequence<T extends { id: string }>(papers: T[], orderedPaperIds: string[]) {
  if (orderedPaperIds.length === 0) {
    return papers;
  }

  const order = new Map(orderedPaperIds.map((paperId, index) => [paperId, index]));

  return [...papers].sort((left, right) => {
    const leftIndex = order.get(left.id);
    const rightIndex = order.get(right.id);

    if (typeof leftIndex === "number" && typeof rightIndex === "number") {
      return leftIndex - rightIndex;
    }

    if (typeof leftIndex === "number") {
      return -1;
    }

    if (typeof rightIndex === "number") {
      return 1;
    }

    return 0;
  });
}
