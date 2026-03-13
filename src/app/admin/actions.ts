"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TriggerSource } from "@prisma/client";
import { clearAdminSession, requireAdmin } from "@/lib/auth";
import { runIngestionJob } from "@/lib/ingestion/service";
import { setPublishedPaperState } from "@/lib/publishing/service";
import {
  getCategoryConfigs,
  resetAppSettings,
  updateAppSettings,
  updateCategoryConfigs,
} from "@/lib/settings/service";
import {
  ensurePaperTechnicalBrief,
  getCurrentTechnicalBrief,
} from "@/lib/technical/service";

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}

export async function runDailyRefreshAction(formData: FormData) {
  await requireAdmin("/admin");
  const announcementDay = readString(formData.get("announcementDay"));
  const selectedDay = readString(formData.get("selectedDay"));
  const { sortKey, sortDirection } = await readAdminSortState(formData);
  const recomputeBriefs = formData.get("recomputeBriefs") === "on";

  const result = await runIngestionJob({
    mode: "DAILY",
    triggerSource: TriggerSource.MANUAL,
    announcementDay,
    recomputeScores: true,
    recomputeBriefs,
  });

  revalidateAll();
  redirectToAdmin({
    selectedDay: announcementDay ?? selectedDay,
    notice: "daily-refresh",
    fetched: result.fetchedCount,
    upserted: result.upsertedCount,
    generated: result.summaryCount,
    sortKey,
    sortDirection,
  });
}

export async function runHistoricalRefreshAction(formData: FormData) {
  await requireAdmin("/admin");
  const from = readString(formData.get("from"));
  const to = readString(formData.get("to"));
  const selectedDay = readString(formData.get("selectedDay"));
  const { sortKey, sortDirection } = await readAdminSortState(formData);
  const recomputeBriefs = formData.get("recomputeBriefs") === "on";

  if (!from || !to) {
    redirect("/admin?error=missing-range");
  }

  const result = await runIngestionJob({
    mode: "HISTORICAL",
    triggerSource: TriggerSource.MANUAL,
    from,
    to,
    recomputeScores: true,
    recomputeBriefs,
  });

  revalidateAll();
  redirectToAdmin({
    selectedDay: selectedDay ?? to,
    notice: "historical-refresh",
    fetched: result.fetchedCount,
    upserted: result.upsertedCount,
    generated: result.summaryCount,
    sortKey,
    sortDirection,
  });
}

export async function updateSettingsAction(formData: FormData) {
  await requireAdmin("/admin");
  const selectedDay = readString(formData.get("selectedDay"));
  const { sortKey, sortDirection } = await readAdminSortState(formData);

  const genAiRankingWeights = {
    frontierRelevance: Number(formData.get("frontierRelevance") ?? 0),
    capabilityImpact: Number(formData.get("capabilityImpact") ?? 0),
    realWorldImpact: Number(formData.get("realWorldImpact") ?? 0),
    evidenceStrength: Number(formData.get("evidenceStrength") ?? 0),
    audiencePull: Number(formData.get("audiencePull") ?? 0),
  };

  await updateAppSettings({
    genAiFeaturedCount: Number(formData.get("genAiFeaturedCount") ?? 10),
    genAiShortlistSize: Number(formData.get("genAiShortlistSize") ?? 25),
    highBusinessRelevanceThreshold: Number(
      formData.get("highBusinessRelevanceThreshold") ?? 70,
    ),
    genAiRankingWeights,
    genAiUsePremiumSynthesis: formData.get("genAiUsePremiumSynthesis") === "on",
    pdfCacheDir: String(formData.get("pdfCacheDir") ?? ".paperbrief-cache"),
    primaryCronSchedule: String(
      formData.get("primaryCronSchedule") ?? "15 17 * * 0-4",
    ),
    reconcileCronSchedule: String(
      formData.get("reconcileCronSchedule") ?? "45 20 * * 0-4",
    ),
    reconcileEnabled: formData.get("reconcileEnabled") === "on",
    rssMinDelayMs: Number(formData.get("rssMinDelayMs") ?? 1000),
    apiMinDelayMs: Number(formData.get("apiMinDelayMs") ?? 3100),
    retryBaseDelayMs: Number(formData.get("retryBaseDelayMs") ?? 800),
    feedCacheTtlMinutes: Number(formData.get("feedCacheTtlMinutes") ?? 60),
    apiCacheTtlMinutes: Number(formData.get("apiCacheTtlMinutes") ?? 180),
  });

  revalidateAll();
  redirectToAdmin({
    selectedDay,
    notice: "settings-saved",
    sortKey,
    sortDirection,
  });
}

export async function resetSettingsAction(formData: FormData) {
  await requireAdmin("/admin");
  const selectedDay = readString(formData.get("selectedDay"));
  const { sortKey, sortDirection } = await readAdminSortState(formData);

  await resetAppSettings();
  revalidateAll();
  redirectToAdmin({
    selectedDay,
    notice: "settings-reset",
    sortKey,
    sortDirection,
  });
}

export async function updateCategoriesAction(formData: FormData) {
  await requireAdmin("/admin");
  const selectedDay = readString(formData.get("selectedDay"));
  const { sortKey, sortDirection } = await readAdminSortState(formData);
  const categories = await getCategoryConfigs();

  await updateCategoryConfigs(
    categories.map((category) => ({
      key: category.key,
      label: category.label,
      enabled: formData.get(`enabled__${category.key}`) === "on",
      displayOrder: category.displayOrder,
    })),
  );

  revalidateAll();
  redirectToAdmin({
    selectedDay,
    notice: "categories-saved",
    sortKey,
    sortDirection,
  });
}

export async function togglePublishedPaperAction(formData: FormData) {
  await requireAdmin("/admin");
  const announcementDay = readString(formData.get("announcementDay"));
  const paperId = readString(formData.get("paperId"));
  const published = readString(formData.get("published"));
  const { sortKey, sortDirection } = await readAdminSortState(formData);

  if (!announcementDay || !paperId) {
    redirect("/admin");
  }

  const nextPublishedState = published === "true";

  await setPublishedPaperState({
    announcementDay,
    paperId,
    published: nextPublishedState,
  });

  let briefStatus: "ready" | "missing" | "fallback" | undefined;
  if (nextPublishedState) {
    await ensurePaperTechnicalBrief(paperId, { requirePdf: true });
    const currentBrief = await getCurrentTechnicalBrief(paperId);
    briefStatus = currentBrief
      ? currentBrief.usedFallbackAbstract
        ? "fallback"
        : "ready"
      : "missing";
  }

  revalidateAll();
  redirectToAdmin({
    selectedDay: announcementDay,
    focusPaperId: paperId,
    notice: nextPublishedState ? "paper-published" : "paper-removed",
    briefStatus,
    sortKey,
    sortDirection,
  });
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/admin");
}

function redirectToAdmin(input: {
  selectedDay?: string;
  notice?: string;
  fetched?: number;
  upserted?: number;
  generated?: number;
  focusPaperId?: string;
  briefStatus?: "ready" | "missing" | "fallback";
  sortKey?: string;
  sortDirection?: string;
}): never {
  const search = new URLSearchParams();

  if (input.selectedDay) {
    search.set("day", input.selectedDay);
  }

  if (input.notice) {
    search.set("notice", input.notice);
  }

  if (typeof input.fetched === "number") {
    search.set("fetched", String(input.fetched));
  }

  if (typeof input.upserted === "number") {
    search.set("upserted", String(input.upserted));
  }

  if (typeof input.generated === "number") {
    search.set("generated", String(input.generated));
  }

  if (input.focusPaperId) {
    search.set("focusPaper", input.focusPaperId);
  }

  if (input.briefStatus) {
    search.set("brief", input.briefStatus);
  }

  if (input.sortKey) {
    search.set("sort", input.sortKey);
  }

  if (input.sortDirection) {
    search.set("dir", input.sortDirection);
  }

  const query = search.toString();
  redirect(query ? `/admin?${query}` : "/admin");
}

function readString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function readAdminSortState(formData: FormData) {
  const refererSortState = await readAdminSortStateFromReferer();

  return {
    sortKey: refererSortState.sortKey ?? readString(formData.get("sort")),
    sortDirection: refererSortState.sortDirection ?? readString(formData.get("dir")),
  };
}

async function readAdminSortStateFromReferer() {
  const referer = (await headers()).get("referer");
  if (!referer) {
    return {
      sortKey: undefined,
      sortDirection: undefined,
    };
  }

  try {
    const url = new URL(referer);
    return {
      sortKey: readString(url.searchParams.get("sort")),
      sortDirection: readString(url.searchParams.get("dir")),
    };
  } catch {
    return {
      sortKey: undefined,
      sortDirection: undefined,
    };
  }
}
