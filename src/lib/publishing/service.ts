import { assertPrismaRuntimeCompatibility, prisma } from "@/lib/db";
import { getWeekEnd } from "@/lib/utils/dates";

export async function getPublishedPaperIdsForDay(announcementDay: string) {
  assertPrismaRuntimeCompatibility();
  const items = await prisma.publishedPaper.findMany({
    where: { announcementDay },
    select: { paperId: true },
  });

  return items.map((item) => item.paperId);
}

export async function getPublishedPaperCountForDay(announcementDay: string) {
  assertPrismaRuntimeCompatibility();
  return prisma.publishedPaper.count({
    where: { announcementDay },
  });
}

export async function getPublishedPaperIdsForWeek(weekStart: string) {
  assertPrismaRuntimeCompatibility();
  const items = await prisma.publishedPaper.findMany({
    where: {
      announcementDay: {
        gte: weekStart,
        lte: getWeekEnd(weekStart),
      },
    },
    select: { paperId: true },
  });

  return Array.from(new Set(items.map((item) => item.paperId)));
}

export async function setPublishedPaperState(input: {
  announcementDay: string;
  paperId: string;
  published: boolean;
}) {
  assertPrismaRuntimeCompatibility();
  const paper = await prisma.paper.findUnique({
    where: { id: input.paperId },
    select: { id: true, announcementDay: true },
  });

  if (!paper) {
    throw new Error("Paper not found.");
  }

  if (paper.announcementDay !== input.announcementDay) {
    throw new Error("Paper does not belong to the selected announcement day.");
  }

  if (input.published) {
    await prisma.publishedPaper.upsert({
      where: {
        announcementDay_paperId: {
          announcementDay: input.announcementDay,
          paperId: input.paperId,
        },
      },
      update: {},
      create: {
        announcementDay: input.announcementDay,
        paperId: input.paperId,
      },
    });

    return;
  }

  await prisma.publishedPaper.deleteMany({
    where: {
      announcementDay: input.announcementDay,
      paperId: input.paperId,
    },
  });
}
