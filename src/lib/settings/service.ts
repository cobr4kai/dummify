import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_CATEGORIES,
  DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
  LEGACY_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
  PREVIOUS_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
} from "@/config/defaults";
import {
  LEGACY_EXECUTIVE_SCORE_COMPONENTS,
  mapLegacyWeightsToVisible,
  type LegacyExecutiveScoringWeights,
} from "@/lib/scoring/model";
import type { ExecutiveScoringWeights } from "@/lib/types";

const executiveRankingWeightsSchema = z.object({
  frontierRelevance: z.number(),
  capabilityImpact: z.number(),
  realWorldImpact: z.number(),
  evidenceStrength: z.number(),
  audiencePull: z.number(),
});

const legacyExecutiveRankingWeightsSchema = z.object({
  frontierRelevance: z.number(),
  capabilityImpact: z.number(),
  trainingEconomicsImpact: z.number(),
  inferenceEconomicsImpact: z.number(),
  platformStackImpact: z.number(),
  strategicBusinessImpact: z.number(),
  evidenceStrength: z.number(),
  claritySignal: z.number(),
});

const appSettingsSchema = z.object({
  featuredPaperCount: z.number().int().min(1).max(50),
  genAiFeaturedCount: z.number().int().min(1).max(20),
  genAiShortlistSize: z.number().int().min(10).max(100),
  activeHomepageAnnouncementDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  highBusinessRelevanceThreshold: z.number().min(0).max(100),
  audienceFitThreshold: z.number().min(0).max(100),
  rankingWeights: executiveRankingWeightsSchema,
  genAiRankingWeights: executiveRankingWeightsSchema,
  genAiUsePremiumSynthesis: z.boolean(),
  pdfCacheDir: z.string().min(1),
  primaryCronSchedule: z.string().min(1),
  reconcileCronSchedule: z.string().min(1),
  reconcileEnabled: z.boolean(),
  rssMinDelayMs: z.number().int().min(0).max(60000),
  apiMinDelayMs: z.number().int().min(0).max(60000),
  retryBaseDelayMs: z.number().int().min(100).max(60000),
  feedCacheTtlMinutes: z.number().int().min(0).max(24 * 60),
  apiCacheTtlMinutes: z.number().int().min(0).max(24 * 60),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

const settingDescriptions: Record<keyof AppSettings, string> = {
  featuredPaperCount: "Legacy featured paper count retained for compatibility.",
  genAiFeaturedCount: "Number of papers to feature in the daily frontier brief.",
  genAiShortlistSize:
    "Metadata-ranked shortlist size used before selecting the final daily brief.",
  activeHomepageAnnouncementDay:
    "Single announcement day currently shown on the public homepage.",
  highBusinessRelevanceThreshold:
    "Minimum total score used for the archive high-signal toggle.",
  audienceFitThreshold: "Legacy audience threshold retained for compatibility.",
  rankingWeights: "Legacy score weights retained for compatibility.",
  genAiRankingWeights:
    "Editable heuristic weights for the canonical daily brief score, with extra emphasis on frontier relevance, real-world impact, evidence strength, and audience pull.",
  genAiUsePremiumSynthesis:
    "Whether to use the premium synthesis model when the environment allows it.",
  pdfCacheDir: "Local directory used to cache official arXiv PDFs and extracted page text.",
  primaryCronSchedule: "Primary cron schedule for the daily arXiv ingest run.",
  reconcileCronSchedule: "Follow-up reconciliation cron schedule for the same daily cycle.",
  reconcileEnabled: "Whether the lighter reconciliation cron run is enabled.",
  rssMinDelayMs: "Minimum delay between sequential arXiv RSS requests.",
  apiMinDelayMs: "Minimum delay between sequential export.arxiv.org API requests.",
  retryBaseDelayMs: "Base retry delay used for arXiv feed and API backoff.",
  feedCacheTtlMinutes: "TTL for cached RSS feed responses.",
  apiCacheTtlMinutes: "TTL for cached export.arxiv.org API responses.",
};

function serializeSettingValue(value: AppSettings[keyof AppSettings]) {
  return value === null ? Prisma.JsonNull : value;
}

export async function ensureDefaultSettings() {
  await prisma.$transaction([
    ...DEFAULT_CATEGORIES.map((category, index) =>
      prisma.categoryConfig.upsert({
        where: { key: category.key },
        update: {
          label: category.label,
          displayOrder: index,
        },
        create: {
          key: category.key,
          label: category.label,
          enabled: category.enabled,
          displayOrder: index,
        },
      }),
    ),
    ...(
      Object.entries(DEFAULT_APP_SETTINGS) as [
        keyof AppSettings,
        AppSettings[keyof AppSettings],
      ][]
    ).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: {
          description: settingDescriptions[key],
        },
        create: {
          key,
          value: serializeSettingValue(value),
          description: settingDescriptions[key],
        },
      }),
    ),
  ]);

  await upgradeLegacyRankingWeightDefaults();
}

export async function getCategoryConfigs() {
  await ensureDefaultSettings();
  return prisma.categoryConfig.findMany({
    orderBy: [{ enabled: "desc" }, { displayOrder: "asc" }],
  });
}

export async function getEnabledCategoryKeys() {
  const categories = await getCategoryConfigs();
  return categories.filter((category) => category.enabled).map((category) => category.key);
}

export async function getAppSettings(): Promise<AppSettings> {
  await ensureDefaultSettings();
  const settings = await prisma.appSetting.findMany();
  const raw = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  return appSettingsSchema.parse({
    featuredPaperCount:
      typeof raw.featuredPaperCount === "number"
        ? raw.featuredPaperCount
        : DEFAULT_APP_SETTINGS.featuredPaperCount,
    genAiFeaturedCount:
      typeof raw.genAiFeaturedCount === "number"
        ? raw.genAiFeaturedCount
        : DEFAULT_APP_SETTINGS.genAiFeaturedCount,
    genAiShortlistSize:
      typeof raw.genAiShortlistSize === "number"
        ? raw.genAiShortlistSize
        : DEFAULT_APP_SETTINGS.genAiShortlistSize,
    activeHomepageAnnouncementDay:
      typeof raw.activeHomepageAnnouncementDay === "string"
        ? raw.activeHomepageAnnouncementDay
        : raw.activeHomepageAnnouncementDay === null
          ? null
          : DEFAULT_APP_SETTINGS.activeHomepageAnnouncementDay,
    highBusinessRelevanceThreshold:
      typeof raw.highBusinessRelevanceThreshold === "number"
        ? raw.highBusinessRelevanceThreshold
        : DEFAULT_APP_SETTINGS.highBusinessRelevanceThreshold,
    audienceFitThreshold:
      typeof raw.audienceFitThreshold === "number"
        ? raw.audienceFitThreshold
        : DEFAULT_APP_SETTINGS.audienceFitThreshold,
    rankingWeights:
      parseExecutiveWeights(raw.rankingWeights) ??
      DEFAULT_APP_SETTINGS.rankingWeights,
    genAiRankingWeights:
      parseExecutiveWeights(raw.genAiRankingWeights) ??
      DEFAULT_APP_SETTINGS.genAiRankingWeights,
    genAiUsePremiumSynthesis:
      typeof raw.genAiUsePremiumSynthesis === "boolean"
        ? raw.genAiUsePremiumSynthesis
        : DEFAULT_APP_SETTINGS.genAiUsePremiumSynthesis,
    pdfCacheDir:
      typeof raw.pdfCacheDir === "string"
        ? raw.pdfCacheDir
        : DEFAULT_APP_SETTINGS.pdfCacheDir,
    primaryCronSchedule:
      typeof raw.primaryCronSchedule === "string"
        ? raw.primaryCronSchedule
        : DEFAULT_APP_SETTINGS.primaryCronSchedule,
    reconcileCronSchedule:
      typeof raw.reconcileCronSchedule === "string"
        ? raw.reconcileCronSchedule
        : DEFAULT_APP_SETTINGS.reconcileCronSchedule,
    reconcileEnabled:
      typeof raw.reconcileEnabled === "boolean"
        ? raw.reconcileEnabled
        : DEFAULT_APP_SETTINGS.reconcileEnabled,
    rssMinDelayMs:
      typeof raw.rssMinDelayMs === "number"
        ? raw.rssMinDelayMs
        : DEFAULT_APP_SETTINGS.rssMinDelayMs,
    apiMinDelayMs:
      typeof raw.apiMinDelayMs === "number"
        ? raw.apiMinDelayMs
        : DEFAULT_APP_SETTINGS.apiMinDelayMs,
    retryBaseDelayMs:
      typeof raw.retryBaseDelayMs === "number"
        ? raw.retryBaseDelayMs
        : DEFAULT_APP_SETTINGS.retryBaseDelayMs,
    feedCacheTtlMinutes:
      typeof raw.feedCacheTtlMinutes === "number"
        ? raw.feedCacheTtlMinutes
        : DEFAULT_APP_SETTINGS.feedCacheTtlMinutes,
    apiCacheTtlMinutes:
      typeof raw.apiCacheTtlMinutes === "number"
        ? raw.apiCacheTtlMinutes
        : DEFAULT_APP_SETTINGS.apiCacheTtlMinutes,
  });
}

export async function updateCategoryConfigs(
  categories: Array<{ key: string; label: string; enabled: boolean; displayOrder: number }>,
) {
  await prisma.$transaction(
    categories.map((category) =>
      prisma.categoryConfig.upsert({
        where: { key: category.key },
        update: {
          label: category.label,
          enabled: category.enabled,
          displayOrder: category.displayOrder,
        },
        create: category,
      }),
    ),
  );
}

export async function updateAppSettings(input: Partial<AppSettings>) {
  const current = await getAppSettings();
  const merged = appSettingsSchema.parse({
    ...current,
    ...input,
    rankingWeights:
      input.rankingWeights
        ? normalizeWeights(input.rankingWeights)
        : current.rankingWeights,
    genAiRankingWeights:
      input.genAiRankingWeights
        ? normalizeWeights(input.genAiRankingWeights)
        : current.genAiRankingWeights,
  });

  await prisma.$transaction(
    (
      Object.entries(merged) as [keyof AppSettings, AppSettings[keyof AppSettings]][]
    ).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: serializeSettingValue(value) },
        create: {
          key,
          value: serializeSettingValue(value),
          description: settingDescriptions[key],
        },
      }),
    ),
  );

  return merged;
}

export async function resetAppSettings() {
  return updateAppSettings({
    featuredPaperCount: DEFAULT_APP_SETTINGS.featuredPaperCount,
    genAiFeaturedCount: DEFAULT_APP_SETTINGS.genAiFeaturedCount,
    genAiShortlistSize: DEFAULT_APP_SETTINGS.genAiShortlistSize,
    activeHomepageAnnouncementDay: DEFAULT_APP_SETTINGS.activeHomepageAnnouncementDay,
    highBusinessRelevanceThreshold:
      DEFAULT_APP_SETTINGS.highBusinessRelevanceThreshold,
    audienceFitThreshold: DEFAULT_APP_SETTINGS.audienceFitThreshold,
    rankingWeights: DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
    genAiRankingWeights: DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
    genAiUsePremiumSynthesis: DEFAULT_APP_SETTINGS.genAiUsePremiumSynthesis,
    pdfCacheDir: DEFAULT_APP_SETTINGS.pdfCacheDir,
    primaryCronSchedule: DEFAULT_APP_SETTINGS.primaryCronSchedule,
    reconcileCronSchedule: DEFAULT_APP_SETTINGS.reconcileCronSchedule,
    reconcileEnabled: DEFAULT_APP_SETTINGS.reconcileEnabled,
    rssMinDelayMs: DEFAULT_APP_SETTINGS.rssMinDelayMs,
    apiMinDelayMs: DEFAULT_APP_SETTINGS.apiMinDelayMs,
    retryBaseDelayMs: DEFAULT_APP_SETTINGS.retryBaseDelayMs,
    feedCacheTtlMinutes: DEFAULT_APP_SETTINGS.feedCacheTtlMinutes,
    apiCacheTtlMinutes: DEFAULT_APP_SETTINGS.apiCacheTtlMinutes,
  });
}


async function upgradeLegacyRankingWeightDefaults() {
  const weightKeys = ["rankingWeights", "genAiRankingWeights"] as const;
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: [...weightKeys],
      },
    },
  });

  const updates = settings.flatMap((setting) => {
    const legacyParsed = legacyExecutiveRankingWeightsSchema.safeParse(setting.value);

    if (!legacyParsed.success) {
      return [];
    }

    const nextValue =
      weightsMatchLegacy(
        legacyParsed.data,
        LEGACY_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
      ) ||
      weightsMatchLegacy(
        legacyParsed.data,
        PREVIOUS_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
      )
        ? DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS
        : normalizeWeights(mapLegacyWeightsToVisible(legacyParsed.data));

    return [
      prisma.appSetting.update({
        where: { key: setting.key },
        data: { value: nextValue },
      }),
    ];
  });

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

function weightsMatchLegacy(
  left: LegacyExecutiveScoringWeights,
  right: LegacyExecutiveScoringWeights,
) {
  return LEGACY_EXECUTIVE_SCORE_COMPONENTS.every(
    (key) => Math.abs(left[key] - right[key]) < 0.0001,
  );
}

function normalizeWeights(weights: ExecutiveScoringWeights) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS;
  }

  const normalized = Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / total]),
  ) as ExecutiveScoringWeights;

  return executiveRankingWeightsSchema.parse(normalized);
}

function parseExecutiveWeights(value: unknown) {
  const parsed = executiveRankingWeightsSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const legacyParsed = legacyExecutiveRankingWeightsSchema.safeParse(value);
  if (legacyParsed.success) {
    return normalizeWeights(mapLegacyWeightsToVisible(legacyParsed.data));
  }

  return null;
}
