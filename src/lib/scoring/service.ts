import { DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS } from "@/config/defaults";
import type { StructuredMetadataEnrichment } from "@/lib/metadata/schema";
import {
  EXECUTIVE_CATEGORY_BOOSTS,
  EXECUTIVE_COMPONENT_KEYWORDS,
  EXECUTIVE_PRIORITY_FEED_CATEGORIES,
} from "@/lib/scoring/keywords";
import {
  defaultReasonForVisibleComponent,
  EXECUTIVE_SCORE_COMPONENT_METADATA,
  mapPreviousVisibleBreakdownToVisible,
  PREVIOUS_VISIBLE_EXECUTIVE_SCORE_COMPONENTS,
  type PreviousVisibleExecutiveScoreBreakdown,
  type PreviousVisibleExecutiveScoreComponentKey,
} from "@/lib/scoring/model";
import type {
  ExecutiveScoreComputationResult,
  ExecutiveScoringWeights,
  PaperSourceRecord,
  ScoreBreakdownItem,
} from "@/lib/types";
import {
  clamp,
  normalizeSearchText,
  round,
  splitKeywords,
} from "@/lib/utils/strings";

type AnalysisSignal = Pick<
  StructuredMetadataEnrichment,
  | "thesis"
  | "whyItMatters"
  | "topicTags"
  | "methodType"
  | "evidenceStrength"
  | "likelyAudience"
  | "caveats"
  | "noveltyScore"
  | "businessRelevanceScore"
  | "sourceBasis"
>;

export function computeBriefScore(
  paper: Pick<PaperSourceRecord, "title" | "abstract" | "categories"> &
    Partial<Pick<PaperSourceRecord, "sourceFeedCategories" | "sourceMetadata">>,
  weights: ExecutiveScoringWeights = DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
  analysis?: AnalysisSignal | null,
): ExecutiveScoreComputationResult {
  const normalizedText = normalizeSearchText(
    [
      paper.title,
      paper.abstract,
      analysis?.thesis,
      analysis?.whyItMatters,
      analysis?.topicTags.join(" "),
      analysis?.methodType,
      analysis?.likelyAudience.join(" "),
      analysis?.caveats.join(" "),
      analysis?.sourceBasis.replace(/_/g, " "),
    ]
      .filter(Boolean)
      .join(" "),
  );

  const previousVisibleBreakdown = {} as PreviousVisibleExecutiveScoreBreakdown;

  for (const key of PREVIOUS_VISIBLE_EXECUTIVE_SCORE_COMPONENTS) {
    previousVisibleBreakdown[key] = computePreviousVisibleComponentScore(
      key,
      normalizedText,
      paper.categories,
      paper.abstract,
      paper.sourceMetadata,
      analysis ?? undefined,
    );
  }

  applyCrossListBonus(previousVisibleBreakdown, paper.sourceFeedCategories ?? []);

  const breakdown = applyTargetWeights(
    mapPreviousVisibleBreakdownToVisible(previousVisibleBreakdown),
    weights,
  );
  const totalScore = round(
    Object.values(breakdown).reduce((sum, item) => sum + item.weightedScore, 0),
  );
  const strongestSignals = Object.values(breakdown)
    .sort((left, right) => right.weightedScore - left.weightedScore)
    .slice(0, 3)
    .map((item) => item.reason);

  return {
    totalScore,
    frontierRelevanceScore: breakdown.frontierRelevance.rawScore,
    breakdown,
    rationale: strongestSignals.join(" "),
  };
}

export function getScoreModeLabel() {
  return "TL;DR score";
}

function computePreviousVisibleComponentScore(
  key: PreviousVisibleExecutiveScoreComponentKey,
  normalizedText: string,
  categories: string[],
  abstract: string,
  sourceMetadata?: Record<string, unknown>,
  analysis?: Pick<
    StructuredMetadataEnrichment,
    | "topicTags"
    | "methodType"
    | "evidenceStrength"
    | "likelyAudience"
    | "caveats"
    | "noveltyScore"
    | "businessRelevanceScore"
    | "sourceBasis"
  >,
): ScoreBreakdownItem<PreviousVisibleExecutiveScoreComponentKey> {
  let rawScore = baseComponentScore(key, abstract, analysis);
  const reasons: Array<{ reason: string; weight: number }> = [];

  for (const matcher of EXECUTIVE_COMPONENT_KEYWORDS[key]) {
    if (matcher.pattern.test(normalizedText)) {
      rawScore += matcher.score;
      reasons.push({
        reason: matcher.reason,
        weight: Math.abs(matcher.score),
      });
    }
  }

  const categoryBoost = EXECUTIVE_CATEGORY_BOOSTS[key];
  if (categoryBoost) {
    for (const category of categories) {
      rawScore += categoryBoost[category] ?? 0;
    }
  }

  if (key === "realWorldImpact") {
    const institutionSignal = readInstitutionSignal(sourceMetadata);
    if (institutionSignal > 0) {
      rawScore += institutionSignal;
      reasons.push({
        reason:
          "Optional external metadata links the paper to institutions that often influence deployed AI systems.",
        weight: institutionSignal,
      });
    }
  }

  if (analysis) {
    applyStructuredMetadataSignal(key, analysis, reasons, (delta) => {
      rawScore += delta;
    });
  }

  rawScore = clamp(rawScore);
  const topReason = reasons.sort((left, right) => right.weight - left.weight)[0];

  return {
    key,
    label: key,
    rawScore,
    weight: 0,
    weightedScore: 0,
    reason: topReason?.reason ?? defaultReasonForPreviousVisibleComponent(key, rawScore),
  };
}

function applyTargetWeights(
  breakdown: ExecutiveScoreComputationResult["breakdown"],
  weights: ExecutiveScoringWeights,
) {
  return Object.fromEntries(
    Object.entries(breakdown).map(([key, item]) => {
      const weight = weights[key as keyof ExecutiveScoringWeights];
      return [
        key,
        {
          ...item,
          weight,
          weightedScore: round(item.rawScore * weight),
          label:
            EXECUTIVE_SCORE_COMPONENT_METADATA[key as keyof typeof EXECUTIVE_SCORE_COMPONENT_METADATA]
              .label,
        },
      ];
    }),
  ) as ExecutiveScoreComputationResult["breakdown"];
}

function baseComponentScore(
  key: PreviousVisibleExecutiveScoreComponentKey,
  abstract: string,
  analysis?: Pick<
    StructuredMetadataEnrichment,
    "evidenceStrength" | "noveltyScore" | "businessRelevanceScore" | "likelyAudience"
  >,
) {
  const keywordCount = splitKeywords(abstract).length;
  const sentenceCount = abstract.split(/[.!?]+/).filter(Boolean).length || 1;
  const averageSentenceLength = keywordCount / sentenceCount;
  const acronymCount = (abstract.match(/\b[A-Z]{2,}\b/g) ?? []).length;

  if (key === "audiencePull") {
    let score = 40;

    if (averageSentenceLength <= 24) {
      score += 14;
    } else if (averageSentenceLength >= 35) {
      score -= 8;
    }

    if (acronymCount > 6) {
      score -= 10;
    }

    if (analysis) {
      score +=
        analysis.likelyAudience.filter((audience) => audience !== "researchers").length * 5;
    }

    return score;
  }

  if (key === "evidenceStrength") {
    const baseScore = 26;
    if (!analysis) {
      return baseScore;
    }

    if (analysis.evidenceStrength === "high") {
      return baseScore + 16;
    }
    if (analysis.evidenceStrength === "medium") {
      return baseScore + 8;
    }
    return baseScore - 2;
  }

  if (key === "frontierRelevance") {
    return analysis ? 28 + Math.round((analysis.noveltyScore - 50) / 8) : 28;
  }

  if (key === "realWorldImpact") {
    return analysis ? 24 + Math.round((analysis.businessRelevanceScore - 50) / 7) : 24;
  }

  return 22;
}

function applyCrossListBonus(
  breakdown: PreviousVisibleExecutiveScoreBreakdown,
  sourceFeedCategories: string[],
) {
  const relevantFeedCount = new Set(
    sourceFeedCategories.filter((category) =>
      EXECUTIVE_PRIORITY_FEED_CATEGORIES.includes(
        category as (typeof EXECUTIVE_PRIORITY_FEED_CATEGORIES)[number],
      ),
    ),
  ).size;
  if (relevantFeedCount < 2) {
    return;
  }

  const overlapBonus = Math.min(12, (relevantFeedCount - 1) * 6);
  const item = breakdown.frontierRelevance;
  item.rawScore = clamp(item.rawScore + overlapBonus);
  item.reason =
    "Cross-listed across multiple operator-relevant arXiv feeds, increasing odds that the paper matters beyond a narrow niche.";
}

function readInstitutionSignal(sourceMetadata?: Record<string, unknown>) {
  const institutionSignals = sourceMetadata?.institutionSignals;
  if (!Array.isArray(institutionSignals) || institutionSignals.length === 0) {
    return 0;
  }

  return Math.min(8, institutionSignals.length * 4);
}

function applyStructuredMetadataSignal(
  key: PreviousVisibleExecutiveScoreComponentKey,
  analysis: Pick<
    StructuredMetadataEnrichment,
    | "topicTags"
    | "methodType"
    | "evidenceStrength"
    | "likelyAudience"
    | "caveats"
    | "noveltyScore"
    | "businessRelevanceScore"
    | "sourceBasis"
  >,
  reasons: Array<{ reason: string; weight: number }>,
  applyDelta: (delta: number) => void,
) {
  let delta = 0;
  let reason: string | null = null;

  if (key === "frontierRelevance") {
    if (
      analysis.topicTags.some((tag) =>
        ["agents", "models", "inference", "infra", "reasoning"].includes(tag),
      )
    ) {
      delta += 6;
      reason =
        "Structured metadata tags the paper as directly relevant to current frontier deployment themes.";
    }
  }

  if (key === "capabilityImpact") {
    if (/(training|inference|agent|world model|retrieval|benchmark|evaluation)/i.test(analysis.methodType)) {
      delta += 5;
      reason =
        "Structured metadata suggests the paper proposes a concrete method, benchmark, or system rather than only descriptive framing.";
    }
  }

  if (key === "realWorldImpact") {
    if (analysis.sourceBasis === "editorial") {
      delta += 6;
      reason =
        "The paper already cleared the curated editorial layer, which is a useful proxy for practical importance.";
    } else if (analysis.businessRelevanceScore >= 70) {
      delta += 5;
      reason =
        "Structured metadata judges the paper as unusually relevant to business or product decision-making.";
    }
  }

  if (key === "evidenceStrength") {
    if (analysis.evidenceStrength === "low" && analysis.caveats.length > 0) {
      delta -= 4;
      reason =
        "Structured metadata keeps the evidence read conservative because the abstract signals limited quantitative grounding.";
    }
  }

  if (key === "audiencePull") {
    if (analysis.likelyAudience.some((audience) => audience !== "researchers")) {
      delta += 6;
      reason =
        "Structured metadata points to immediate relevance for non-research readers such as builders, PMs, or investors.";
    }
  }

  if (delta !== 0) {
    applyDelta(delta);
    if (reason) {
      reasons.push({
        reason,
        weight: Math.abs(delta),
      });
    }
  }
}

function defaultReasonForPreviousVisibleComponent(
  key: PreviousVisibleExecutiveScoreComponentKey,
  rawScore: number,
) {
  const mappedDefaults: Record<PreviousVisibleExecutiveScoreComponentKey, string> = {
    frontierRelevance: defaultReasonForVisibleComponent("frontierRelevance", rawScore),
    capabilityImpact:
      rawScore >= 60
        ? "Capability impact is a meaningful signal in the title and abstract."
        : "Capability impact is present but not dominant in the abstract.",
    realWorldImpact:
      rawScore >= 60
        ? "Practical consequences are a meaningful signal in the paper framing."
        : "Practical consequences are present but not dominant in the abstract.",
    evidenceStrength: defaultReasonForVisibleComponent("evidenceCredibility", rawScore),
    audiencePull: defaultReasonForVisibleComponent("audienceInterest", rawScore),
  };

  return mappedDefaults[key];
}
