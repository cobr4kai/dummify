import { prisma } from "@/lib/db";

export async function getPublishedPaperIdsForDay(announcementDay: string) {
  const items = await prisma.publishedPaper.findMany({
    where: { announcementDay },
    select: { paperId: true },
  });

  return items.map((item) => item.paperId);
}

export async function getPublishedPaperCountForDay(announcementDay: string) {
  return prisma.publishedPaper.count({
    where: { announcementDay },
  });
}

export async function setPublishedPaperState(input: {
  announcementDay: string;
  paperId: string;
  published: boolean;
}) {
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
