import { assertPrismaRuntimeCompatibility, prisma } from "@/lib/db";
import { getWeekEnd, getWeekStart } from "@/lib/utils/dates";

const PUBLISHED_ORDER_SETTING_PREFIX = "publishedPaperOrderByWeek:";

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
  return readPublishedPaperIdsForWeek(weekStart);
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

    await syncPublishedPaperOrderForWeek(getWeekStart(input.announcementDay), {
      appendedPaperId: input.paperId,
    });
    return;
  }

  await prisma.publishedPaper.deleteMany({
    where: {
      announcementDay: input.announcementDay,
      paperId: input.paperId,
    },
  });

  await syncPublishedPaperOrderForWeek(getWeekStart(input.announcementDay));
}

export async function reorderPublishedPaperForWeek(input: {
  weekStart: string;
  paperId: string;
  direction: "up" | "down";
}) {
  assertPrismaRuntimeCompatibility();
  const currentOrder = await readPublishedPaperIdsForWeek(input.weekStart);
  const currentIndex = currentOrder.indexOf(input.paperId);

  if (currentIndex === -1) {
    throw new Error("Paper is not in the curated homepage set.");
  }

  const targetIndex =
    input.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= currentOrder.length) {
    return currentOrder;
  }

  const nextOrder = [...currentOrder];
  const [paperId] = nextOrder.splice(currentIndex, 1);
  nextOrder.splice(targetIndex, 0, paperId);

  await writePublishedPaperOrderForWeek(input.weekStart, nextOrder);
  return nextOrder;
}

async function readPublishedPaperIdsForWeek(weekStart: string) {
  const items = await prisma.publishedPaper.findMany({
    where: {
      announcementDay: {
        gte: weekStart,
        lte: getWeekEnd(weekStart),
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { paperId: true },
  });

  const existingPaperIds = Array.from(new Set(items.map((item) => item.paperId)));
  const storedOrder = await readStoredPublishedPaperOrderForWeek(weekStart);
  return normalizePublishedPaperOrder(existingPaperIds, storedOrder);
}

async function syncPublishedPaperOrderForWeek(
  weekStart: string,
  options?: { appendedPaperId?: string },
) {
  const items = await prisma.publishedPaper.findMany({
    where: {
      announcementDay: {
        gte: weekStart,
        lte: getWeekEnd(weekStart),
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { paperId: true },
  });

  const existingPaperIds = Array.from(new Set(items.map((item) => item.paperId)));
  const storedOrder = await readStoredPublishedPaperOrderForWeek(weekStart);
  const normalizedOrder = normalizePublishedPaperOrder(existingPaperIds, storedOrder);

  if (
    options?.appendedPaperId &&
    existingPaperIds.includes(options.appendedPaperId) &&
    !normalizedOrder.includes(options.appendedPaperId)
  ) {
    normalizedOrder.push(options.appendedPaperId);
  }

  await writePublishedPaperOrderForWeek(weekStart, normalizedOrder);
  return normalizedOrder;
}

async function readStoredPublishedPaperOrderForWeek(weekStart: string) {
  const setting = await prisma.appSetting.findUnique({
    where: { key: getPublishedOrderSettingKey(weekStart) },
    select: { value: true },
  });

  return Array.isArray(setting?.value)
    ? setting.value.map(String).filter(Boolean)
    : [];
}

async function writePublishedPaperOrderForWeek(weekStart: string, paperIds: string[]) {
  const key = getPublishedOrderSettingKey(weekStart);

  if (paperIds.length === 0) {
    await prisma.appSetting.deleteMany({
      where: { key },
    });
    return;
  }

  await prisma.appSetting.upsert({
    where: { key },
    update: {
      value: paperIds,
      description: "Manual paper ordering for the curated weekly homepage edition.",
    },
    create: {
      key,
      value: paperIds,
      description: "Manual paper ordering for the curated weekly homepage edition.",
    },
  });
}

function normalizePublishedPaperOrder(existingPaperIds: string[], storedOrder: string[]) {
  const existingSet = new Set(existingPaperIds);
  const normalized = storedOrder.filter((paperId) => existingSet.has(paperId));

  for (const paperId of existingPaperIds) {
    if (!normalized.includes(paperId)) {
      normalized.push(paperId);
    }
  }

  return normalized;
}

function getPublishedOrderSettingKey(weekStart: string) {
  return `${PUBLISHED_ORDER_SETTING_PREFIX}${weekStart}`;
}
