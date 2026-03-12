"use server";

import { revalidatePath } from "next/cache";
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

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}

export async function runDailyRefreshAction(formData: FormData) {
  await requireAdmin("/admin");
  const day = formData.get("announcementDay");
  const recomputeBriefs = formData.get("recomputeBriefs") === "on";

  await runIngestionJob({
    mode: "DAILY",
    triggerSource: TriggerSource.MANUAL,
    announcementDay: typeof day === "string" && day ? day : undefined,
    recomputeBriefs,
  });

  revalidateAll();
}

export async function runHistoricalRefreshAction(formData: FormData) {
  await requireAdmin("/admin");
  const from = formData.get("from");
  const to = formData.get("to");
  const recomputeBriefs = formData.get("recomputeBriefs") === "on";

  if (typeof from !== "string" || typeof to !== "string" || !from || !to) {
    redirect("/admin?error=missing-range");
  }

  await runIngestionJob({
    mode: "HISTORICAL",
    triggerSource: TriggerSource.MANUAL,
    from,
    to,
    recomputeScores: true,
    recomputeBriefs,
  });

  revalidateAll();
}

export async function updateSettingsAction(formData: FormData) {
  await requireAdmin("/admin");

  const genAiRankingWeights = {
    frontierRelevance: Number(formData.get("frontierRelevance") ?? 0),
    capabilityImpact: Number(formData.get("capabilityImpact") ?? 0),
    trainingEconomicsImpact: Number(formData.get("trainingEconomicsImpact") ?? 0),
    inferenceEconomicsImpact: Number(formData.get("inferenceEconomicsImpact") ?? 0),
    platformStackImpact: Number(formData.get("platformStackImpact") ?? 0),
    strategicBusinessImpact: Number(formData.get("strategicBusinessImpact") ?? 0),
    evidenceStrength: Number(formData.get("evidenceStrength") ?? 0),
    claritySignal: Number(formData.get("claritySignal") ?? 0),
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
}

export async function resetSettingsAction() {
  await requireAdmin("/admin");
  await resetAppSettings();
  revalidateAll();
}

export async function updateCategoriesAction(formData: FormData) {
  await requireAdmin("/admin");
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
}

export async function togglePublishedPaperAction(formData: FormData) {
  await requireAdmin("/admin");
  const announcementDay = formData.get("announcementDay");
  const paperId = formData.get("paperId");
  const published = formData.get("published");

  if (
    typeof announcementDay !== "string" ||
    !announcementDay ||
    typeof paperId !== "string" ||
    !paperId
  ) {
    redirect("/admin");
  }

  await setPublishedPaperState({
    announcementDay,
    paperId,
    published: published === "true",
  });

  revalidateAll();
  redirect(`/admin?day=${encodeURIComponent(announcementDay)}`);
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/admin");
}
