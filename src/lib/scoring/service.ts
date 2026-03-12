import { DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS } from "@/config/defaults";
import {
  EXECUTIVE_CATEGORY_BOOSTS,
  EXECUTIVE_COMPONENT_KEYWORDS,
  EXECUTIVE_COMPONENT_LABELS,
  EXECUTIVE_PRIORITY_FEED_CATEGORIES,
} from "@/lib/scoring/keywords";
import type {
  ExecutiveScoreBreakdown,
  ExecutiveScoreComponentKey,
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

export function computeBriefScore(
  paper: Pick<PaperSourceRecord, "title" | "abstract" | "categories"> &
    Partial<Pick<PaperSourceRecord, "sourceFeedCategories" | "sourceMetadata">>,
  weights: ExecutiveScoringWeights = DEFAULT_EXECUTIVE_BRIEF_RANKING_WEIGHTS,
): ExecutiveScoreComputationResult {
  const normalizedText = normalizeSearchText(`${paper.title} ${paper.abstract}`);
  const breakdown = {} as ExecutiveScoreBreakdown;

  for (const key of Object.keys(weights) as ExecutiveScoreComponentKey[]) {
    breakdown[key] = computeExecutiveComponentScore(
      key,
      normalizedText,
      paper.categories,
      weights[key],
      paper.abstract,
      paper.sourceMetadata,
    );
  }

  applyCrossListBonus(breakdown, paper.sourceFeedCategories ?? []);

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
  return "Brief score";
}

function computeExecutiveComponentScore(
  key: ExecutiveScoreComponentKey,
  normalizedText: string,
  categories: string[],
  weight: number,
  abstract: string,
  sourceMetadata?: Record<string, unknown>,
): ScoreBreakdownItem<ExecutiveScoreComponentKey> {
  let rawScore = baseComponentScore(key, abstract);
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

  if (key === "strategicBusinessImpact") {
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

  rawScore = clamp(rawScore);
  const topReason = reasons.sort((left, right) => right.weight - left.weight)[0];

  return {
    key,
    label: EXECUTIVE_COMPONENT_LABELS[key],
    rawScore,
    weight,
    weightedScore: round(rawScore * weight),
    reason:
      topReason?.reason ??
      defaultReasonForComponent(EXECUTIVE_COMPONENT_LABELS[key], rawScore),
  };
}

function baseComponentScore(key: ExecutiveScoreComponentKey, abstract: string) {
  const keywordCount = splitKeywords(abstract).length;
  const sentenceCount = abstract.split(/[.!?]+/).filter(Boolean).length || 1;
  const averageSentenceLength = keywordCount / sentenceCount;
  const acronymCount = (abstract.match(/\b[A-Z]{2,}\b/g) ?? []).length;

  if (key === "claritySignal") {
    let score = 40;

    if (averageSentenceLength <= 24) {
      score += 14;
    } else if (averageSentenceLength >= 35) {
      score -= 8;
    }

    if (acronymCount > 6) {
      score -= 10;
    }

    return score;
  }

  if (key === "evidenceStrength") {
    return 26;
  }

  if (key === "frontierRelevance") {
    return 28;
  }

  return 22;
}

function defaultReasonForComponent(label: string, rawScore: number) {
  if (rawScore >= 75) {
    return `${label} is a strong signal in the title and abstract.`;
  }

  if (rawScore >= 50) {
    return `${label} appears meaningfully in the paper framing.`;
  }

  return `${label} is present but not dominant in the abstract.`;
}

function applyCrossListBonus(
  breakdown: ExecutiveScoreBreakdown,
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
  item.weightedScore = round(item.rawScore * item.weight);
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
