import type {
  LegacyExecutiveScoringWeights,
  PreviousVisibleExecutiveScoringWeights,
} from "@/lib/scoring/model";
import type { ExecutiveScoringWeights, ScoringPreset } from "@/lib/types";

export const APP_NAME = "Abstracted";
export const APP_TAGLINE =
  "A weekly digest of the most commercially relevant arXiv papers for operators, PMs, investors, and non-research engineers.";
export const PROJECT_CODENAME = "arXiv for Dummies";

export const DEFAULT_CATEGORIES = [
  { key: "cs.AI", label: "Artificial Intelligence", enabled: true },
  { key: "cs.LG", label: "Machine Learning", enabled: true },
  { key: "cs.CL", label: "Computation and Language", enabled: true },
  { key: "cs.MA", label: "Multiagent Systems", enabled: true },
  { key: "cs.CV", label: "Computer Vision", enabled: false },
  { key: "cs.RO", label: "Robotics", enabled: false },
  { key: "cs.IR", label: "Information Retrieval", enabled: false },
  { key: "cs.CY", label: "Computers and Society", enabled: false },
  { key: "stat.ML", label: "Statistical Machine Learning", enabled: false },
] as const;

export const LEGACY_EXECUTIVE_BRIEF_RANKING_WEIGHTS: LegacyExecutiveScoringWeights = {
  frontierRelevance: 0.25,
  capabilityImpact: 0.18,
  trainingEconomicsImpact: 0.12,
  inferenceEconomicsImpact: 0.12,
  platformStackImpact: 0.12,
  strategicBusinessImpact: 0.11,
  evidenceStrength: 0.06,
  claritySignal: 0.04,
};

export const PREVIOUS_EXECUTIVE_BRIEF_RANKING_WEIGHTS: LegacyExecutiveScoringWeights = {
  frontierRelevance: 0.18,
  capabilityImpact: 0.17,
  trainingEconomicsImpact: 0.08,
  inferenceEconomicsImpact: 0.09,
  platformStackImpact: 0.08,
  strategicBusinessImpact: 0.20,
  evidenceStrength: 0.16,
  claritySignal: 0.04,
};

export const PREVIOUS_VISIBLE_EXECUTIVE_BRIEF_RANKING_WEIGHTS: PreviousVisibleExecutiveScoringWeights =
  {
    frontierRelevance: 0.26,
    capabilityImpact: 0.22,
    realWorldImpact: 0.24,
    evidenceStrength: 0.12,
    audiencePull: 0.16,
  };

export const DEFAULT_NON_RESEARCH_RANKING_WEIGHTS: ExecutiveScoringWeights = {
  audienceInterest: 0.28,
  frontierRelevance: 0.26,
  practicalRelevance: 0.22,
  evidenceCredibility: 0.16,
  tldrAccessibility: 0.08,
};

export const DEFAULT_RESEARCH_TLDR_RANKING_WEIGHTS: ExecutiveScoringWeights = {
  audienceInterest: 0.18,
  frontierRelevance: 0.30,
  practicalRelevance: 0.16,
  evidenceCredibility: 0.24,
  tldrAccessibility: 0.12,
};

export const DEFAULT_SCORING_PRESET: ScoringPreset = "non_research";

export function getDefaultRankingWeightsForPreset(
  preset: ScoringPreset,
): ExecutiveScoringWeights {
  return preset === "research_tldr"
    ? DEFAULT_RESEARCH_TLDR_RANKING_WEIGHTS
    : DEFAULT_NON_RESEARCH_RANKING_WEIGHTS;
}

export const DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS =
  getDefaultRankingWeightsForPreset(DEFAULT_SCORING_PRESET);

export const DEFAULT_RANKING_WEIGHTS = DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS;
export const DEFAULT_GENAI_RANKING_WEIGHTS = DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS;

export const DEFAULT_FEATURED_PAPER_COUNT = 10;
export const DEFAULT_GENAI_FEATURED_PAPER_COUNT = 10;
export const DEFAULT_GENAI_SHORTLIST_SIZE = 25;
export const DEFAULT_HIGH_BUSINESS_RELEVANCE_THRESHOLD = 70;
export const DEFAULT_AUDIENCE_FIT_THRESHOLD = 48;
export const DEFAULT_PRIMARY_CRON_SCHEDULE = "15 17 * * 0-4";
export const DEFAULT_RECONCILE_CRON_SCHEDULE = "45 20 * * 0-4";
export const DEFAULT_RECONCILE_ENABLED = true;
export const DEFAULT_RSS_MIN_DELAY_MS = 3100;
export const DEFAULT_API_MIN_DELAY_MS = 3100;
export const DEFAULT_RETRY_BASE_DELAY_MS = 800;
export const DEFAULT_FEED_CACHE_TTL_MINUTES = 60;
export const DEFAULT_API_CACHE_TTL_MINUTES = 180;
export const DEFAULT_PDF_FETCH_MODE = "personal-research-cache";
export const DEFAULT_PDF_FALLBACK_RETRY_COOLDOWN_MINUTES = 180;
export const DEFAULT_CRON_SCHEDULE = DEFAULT_PRIMARY_CRON_SCHEDULE;
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
export const DEFAULT_OPENAI_EXTRACTION_MODEL = "gpt-5-mini";
export const DEFAULT_OPENAI_SYNTHESIS_MODEL = "gpt-5.5";
export const DEFAULT_ENABLE_PREMIUM_SYNTHESIS = true;
export const DEFAULT_PDF_CACHE_DIR =
  process.env.PAPERBRIEF_CACHE_DIR?.trim() || ".paperbrief-cache";
export const DEFAULT_SCORING_VERSION = "2026-03-23.v5";

export const DEFAULT_APP_SETTINGS = {
  featuredPaperCount: DEFAULT_FEATURED_PAPER_COUNT,
  genAiFeaturedCount: DEFAULT_GENAI_FEATURED_PAPER_COUNT,
  genAiShortlistSize: DEFAULT_GENAI_SHORTLIST_SIZE,
  activeHomepageAnnouncementDay: null,
  highBusinessRelevanceThreshold: DEFAULT_HIGH_BUSINESS_RELEVANCE_THRESHOLD,
  audienceFitThreshold: DEFAULT_AUDIENCE_FIT_THRESHOLD,
  rankingWeights: DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
  genAiRankingWeights: DEFAULT_GENAI_RANKING_WEIGHTS,
  genAiScoringPreset: DEFAULT_SCORING_PRESET,
  genAiUsePremiumSynthesis: DEFAULT_ENABLE_PREMIUM_SYNTHESIS,
  pdfCacheDir: DEFAULT_PDF_CACHE_DIR,
  primaryCronSchedule: DEFAULT_PRIMARY_CRON_SCHEDULE,
  reconcileCronSchedule: DEFAULT_RECONCILE_CRON_SCHEDULE,
  reconcileEnabled: DEFAULT_RECONCILE_ENABLED,
  rssMinDelayMs: DEFAULT_RSS_MIN_DELAY_MS,
  apiMinDelayMs: DEFAULT_API_MIN_DELAY_MS,
  retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
  feedCacheTtlMinutes: DEFAULT_FEED_CACHE_TTL_MINUTES,
  apiCacheTtlMinutes: DEFAULT_API_CACHE_TTL_MINUTES,
  pdfFetchMode: DEFAULT_PDF_FETCH_MODE,
  pdfFallbackRetryCooldownMinutes: DEFAULT_PDF_FALLBACK_RETRY_COOLDOWN_MINUTES,
} as const;
