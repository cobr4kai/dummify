import { BriefMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { splitKeywords } from "@/lib/utils/strings";

export async function getRelatedPapers(paperId: string, limit = 4) {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: {
      scores: {
        where: {
          isCurrent: true,
          mode: BriefMode.GENAI,
        },
        take: 1,
      },
    },
  });

  if (!paper) {
    return [];
  }

  const candidates = await prisma.paper.findMany({
    where: {
      id: { not: paperId },
      isDemoData: false,
      technicalBriefs: {
        some: {
          isCurrent: true,
          usedFallbackAbstract: false,
        },
      },
      OR: [
        { primaryCategory: paper.primaryCategory ?? undefined },
        { categoryText: { contains: paper.primaryCategory ?? "" } },
      ],
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
        take: 1,
      },
    },
    orderBy: { publishedAt: "desc" },
    take: 24,
  });

  const keywords = new Set(splitKeywords(paper.searchText).slice(0, 40));

  return candidates
    .map((candidate) => {
      const overlap = splitKeywords(candidate.searchText).filter((keyword) =>
        keywords.has(keyword),
      ).length;
      const score = candidate.scores[0]?.totalScore ?? 0;

      return {
        ...candidate,
        similarityScore: overlap + score / 25,
      };
    })
    .sort((left, right) => right.similarityScore - left.similarityScore)
    .slice(0, limit);
}
