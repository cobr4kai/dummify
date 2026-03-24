export const BRIEF_MODES = ["BUSINESS", "GENAI"] as const;
export type BriefMode = (typeof BRIEF_MODES)[number];

export const AUDIENCES = [
  "general",
  "strategy",
  "finance",
  "procurement",
] as const;

export const ROLE_AUDIENCES = ["strategy", "finance", "procurement"] as const;

export type Audience = (typeof AUDIENCES)[number];
export type RoleAudience = (typeof ROLE_AUDIENCES)[number];

export const MATURITY_ESTIMATES = [
  "RESEARCH_ONLY",
  "NEAR_TERM_PROTOTYPE",
  "LIKELY_PRODUCTIZABLE",
  "INFRA_PLATFORM_RELEVANT",
] as const;

export type MaturityEstimate = (typeof MATURITY_ESTIMATES)[number];

export const SCORING_PRESETS = ["non_research", "research_tldr"] as const;
export type ScoringPreset = (typeof SCORING_PRESETS)[number];

export const EXECUTIVE_SCORE_COMPONENTS = [
  "audienceInterest",
  "frontierRelevance",
  "practicalRelevance",
  "evidenceCredibility",
  "tldrAccessibility",
] as const;

export type ExecutiveScoreComponentKey = (typeof EXECUTIVE_SCORE_COMPONENTS)[number];
export type ExecutiveScoringWeights = Record<ExecutiveScoreComponentKey, number>;

export type ScoreBreakdownItem<TKey extends string = string> = {
  key: TKey;
  label: string;
  rawScore: number;
  weight: number;
  weightedScore: number;
  reason: string;
};

export type ScoreBreakdown<TKey extends string = string> = Record<
  TKey,
  ScoreBreakdownItem<TKey>
>;
export type ExecutiveScoreBreakdown = ScoreBreakdown<ExecutiveScoreComponentKey>;

export type PaperLinkMap = {
  abs: string;
  pdf?: string;
};

export type PaperSourceRecord = {
  arxivId: string;
  version: number;
  versionedId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  sourceFeedCategories: string[];
  primaryCategory?: string;
  publishedAt: Date;
  updatedAt: Date;
  announcementDay: string;
  announceType?: string;
  comment?: string | null;
  journalRef?: string | null;
  doi?: string | null;
  links: PaperLinkMap;
  sourceMetadata: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
};

export type SummaryGlossaryTerm = {
  term: string;
  definition: string;
};

export type SummaryClaim = {
  claim: string;
  supportLevel: "explicit" | "inferred";
};

export type BusinessConsequence = {
  consequence: string;
  audience: RoleAudience | "all";
  confidence: "high" | "medium" | "low";
};

export type StructuredPaperSummary = {
  oneSentenceSummary: string;
  whyThisMatters: string;
  audienceInterpretations: Record<RoleAudience, string>;
  whatThisIsNot: string;
  confidenceNotes: string[];
  jargonBuster: SummaryGlossaryTerm[];
  keyClaims: SummaryClaim[];
  businessConsequences: BusinessConsequence[];
  maturityEstimate: MaturityEstimate;
  leadershipQuestions: string[];
};

export type ExecutiveScoreComputationResult = {
  totalScore: number;
  frontierRelevanceScore: number;
  breakdown: ExecutiveScoreBreakdown;
  rationale: string;
};

export const BRIEF_FOCUS_TAGS = [
  "models",
  "training",
  "inference",
  "infra",
  "agents",
  "data",
] as const;

export type BriefFocusTag = (typeof BRIEF_FOCUS_TAGS)[number];

export const EXECUTIVE_BRIEF_BULLET_AREAS = [
  "implication",
  "watch",
  "vendor-question",
  "assumption",
  "adoption-signal",
  "limitation",
] as const;

export type ExecutiveBriefBulletArea = (typeof EXECUTIVE_BRIEF_BULLET_AREAS)[number];

export type TechnicalCitation = {
  page: number;
  section: string | null;
  quote: string | null;
};

export type ExecutiveBriefKeyStat = {
  label: string;
  value: string;
  context: string;
  citations: TechnicalCitation[];
};

export type TechnicalBriefBullet = {
  label: string;
  text: string;
  impactArea: ExecutiveBriefBulletArea;
  citations: TechnicalCitation[];
};

export type ChunkEvidenceFinding = {
  claim: string;
  impactArea:
    | "capability"
    | "training"
    | "inference"
    | "stack"
    | "strategic"
    | "caveat";
  confidence: "high" | "medium" | "low";
  citations: TechnicalCitation[];
};

export type ChunkEvidenceMetric = {
  label: string;
  value: string;
  context: string;
  citations: TechnicalCitation[];
};

export type ChunkEvidencePayload = {
  summary: string;
  findings: ChunkEvidenceFinding[];
  metrics: ChunkEvidenceMetric[];
  limitations: string[];
};

export type StructuredTechnicalBrief = {
  oneLineVerdict: string;
  keyStats: ExecutiveBriefKeyStat[];
  focusTags: BriefFocusTag[];
  whyItMatters: string;
  whatToIgnore: string;
  bullets: TechnicalBriefBullet[];
  confidenceNotes: string[];
  evidence: ChunkEvidenceFinding[];
  sourceBasis: "full-pdf" | "abstract-fallback";
  usedFallbackAbstract: boolean;
};

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

export type PdfExtractionResult = {
  sourceUrl: string;
  filePath: string | null;
  extractedJsonPath: string | null;
  pageCount: number;
  fileSizeBytes: number | null;
  pages: PdfPageText[];
  usedFallbackAbstract: boolean;
  extractionStatus: "EXTRACTED" | "FALLBACK" | "FAILED";
  extractionError?: string;
};

export type IngestionMode = "DAILY" | "HISTORICAL";
