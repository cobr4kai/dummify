import { z } from "zod";
import {
  EXECUTIVE_SCORE_COMPONENTS,
  type ExecutiveScoreBreakdown,
  type ExecutiveScoreComponentKey,
  type ExecutiveScoringWeights,
  type ScoringPreset,
  type ScoreBreakdown,
  type ScoreBreakdownItem,
} from "@/lib/types";
import { clamp, round } from "@/lib/utils/strings";

export const PREVIOUS_VISIBLE_EXECUTIVE_SCORE_COMPONENTS = [
  "frontierRelevance",
  "capabilityImpact",
  "realWorldImpact",
  "evidenceStrength",
  "audiencePull",
] as const;

export type PreviousVisibleExecutiveScoreComponentKey =
  (typeof PREVIOUS_VISIBLE_EXECUTIVE_SCORE_COMPONENTS)[number];
export type PreviousVisibleExecutiveScoringWeights = Record<
  PreviousVisibleExecutiveScoreComponentKey,
  number
>;
export type PreviousVisibleExecutiveScoreBreakdown = ScoreBreakdown<
  PreviousVisibleExecutiveScoreComponentKey
>;

export const LEGACY_EXECUTIVE_SCORE_COMPONENTS = [
  "frontierRelevance",
  "capabilityImpact",
  "trainingEconomicsImpact",
  "inferenceEconomicsImpact",
  "platformStackImpact",
  "strategicBusinessImpact",
  "evidenceStrength",
  "claritySignal",
] as const;

export type LegacyExecutiveScoreComponentKey =
  (typeof LEGACY_EXECUTIVE_SCORE_COMPONENTS)[number];
export type LegacyExecutiveScoringWeights = Record<
  LegacyExecutiveScoreComponentKey,
  number
>;

export const EXECUTIVE_SCORE_COMPONENT_METADATA: Record<
  ExecutiveScoreComponentKey,
  {
    label: string;
    shortLabel: string;
    description: string;
  }
> = {
  audienceInterest: {
    label: "Audience interest",
    shortLabel: "Audience",
    description:
      "Feels broadly newsworthy or immediately legible to smart readers who care about where AI is going.",
  },
  frontierRelevance: {
    label: "Frontier relevance",
    shortLabel: "Frontier",
    description:
      "Speaks directly to meaningful AI advancement, especially in active areas like agents, multimodality, evaluation, and deployment.",
  },
  practicalRelevance: {
    label: "Practical relevance",
    shortLabel: "Practical",
    description:
      "Has visible consequences for how teams build, deploy, evaluate, buy, or understand real AI systems.",
  },
  evidenceCredibility: {
    label: "Evidence credibility",
    shortLabel: "Evidence",
    description:
      "Shows enough rigor, quantification, or comparative structure that the core claim is worth taking seriously.",
  },
  tldrAccessibility: {
    label: "TL;DR accessibility",
    shortLabel: "TL;DR",
    description:
      "Can be turned into a concise, useful takeaway without asking the reader to parse a dense specialist paper first.",
  },
};

export const SCORING_PRESET_METADATA: Record<
  ScoringPreset,
  {
    label: string;
    description: string;
  }
> = {
  non_research: {
    label: "General audience",
    description:
      "Optimized for broad editorial relevance across builders, operators, PMs, and business-minded readers.",
  },
  research_tldr: {
    label: "Research TL;DR",
    description:
      "Optimized for concise technical significance and strong paper triage without assuming the reader wants a full research deep dive.",
  },
};

export const executiveScoreBreakdownItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  rawScore: z.number(),
  weight: z.number(),
  weightedScore: z.number(),
  reason: z.string(),
});

export const executiveScoreBreakdownRecordSchema = z.record(
  z.string(),
  executiveScoreBreakdownItemSchema,
);

const LEGACY_REAL_WORLD_KEYS: LegacyExecutiveScoreComponentKey[] = [
  "trainingEconomicsImpact",
  "inferenceEconomicsImpact",
  "platformStackImpact",
  "strategicBusinessImpact",
];

export function mapLegacyWeightsToPreviousVisible(
  weights: LegacyExecutiveScoringWeights,
): PreviousVisibleExecutiveScoringWeights {
  return {
    frontierRelevance: weights.frontierRelevance,
    capabilityImpact: weights.capabilityImpact,
    realWorldImpact:
      weights.trainingEconomicsImpact +
      weights.inferenceEconomicsImpact +
      weights.platformStackImpact +
      weights.strategicBusinessImpact,
    evidenceStrength: weights.evidenceStrength,
    audiencePull: weights.claritySignal,
  };
}

export function mapPreviousVisibleWeightsToVisible(
  weights: PreviousVisibleExecutiveScoringWeights,
): ExecutiveScoringWeights {
  return {
    audienceInterest:
      weights.frontierRelevance * 0.2 +
      weights.realWorldImpact * 0.2 +
      weights.audiencePull * 0.65,
    frontierRelevance:
      weights.frontierRelevance * 0.65 + weights.capabilityImpact * 0.55,
    practicalRelevance:
      weights.capabilityImpact * 0.2 + weights.realWorldImpact * 0.7,
    evidenceCredibility: weights.evidenceStrength * 0.85,
    tldrAccessibility:
      weights.frontierRelevance * 0.15 +
      weights.capabilityImpact * 0.25 +
      weights.realWorldImpact * 0.1 +
      weights.evidenceStrength * 0.15 +
      weights.audiencePull * 0.35,
  };
}

export function mapLegacyWeightsToVisible(
  weights: LegacyExecutiveScoringWeights,
): ExecutiveScoringWeights {
  return mapPreviousVisibleWeightsToVisible(
    mapLegacyWeightsToPreviousVisible(weights),
  );
}

export function normalizeExecutiveScoreBreakdown(
  breakdown: ScoreBreakdown<string>,
): ExecutiveScoreBreakdown {
  const hasVisibleBreakdown = EXECUTIVE_SCORE_COMPONENTS.every(
    (key) => breakdown[key],
  );

  if (hasVisibleBreakdown) {
    return Object.fromEntries(
      EXECUTIVE_SCORE_COMPONENTS.map((key) => {
        const item = breakdown[key] as ScoreBreakdownItem<string>;
        return [
          key,
          buildVisibleScoreItem(
            key,
            item.rawScore,
            item.weight,
            item.reason,
            item.weightedScore,
          ),
        ];
      }),
    ) as ExecutiveScoreBreakdown;
  }

  return mapPreviousVisibleBreakdownToVisible(
    normalizeToPreviousVisibleBreakdown(breakdown),
  );
}

export function mapPreviousVisibleBreakdownToVisible(
  breakdown: PreviousVisibleExecutiveScoreBreakdown,
): ExecutiveScoreBreakdown {
  const weights = mapPreviousVisibleWeightsToVisible(
    Object.fromEntries(
      PREVIOUS_VISIBLE_EXECUTIVE_SCORE_COMPONENTS.map((key) => [
        key,
        breakdown[key]?.weight ?? 0,
      ]),
    ) as PreviousVisibleExecutiveScoringWeights,
  );

  const audienceInterest = buildMappedScoreItem(
    "audienceInterest",
    weights.audienceInterest,
    [
      { item: breakdown.frontierRelevance, coefficient: 0.2 },
      { item: breakdown.realWorldImpact, coefficient: 0.2 },
      { item: breakdown.audiencePull, coefficient: 0.65 },
    ],
  );
  const frontierRelevance = buildMappedScoreItem(
    "frontierRelevance",
    weights.frontierRelevance,
    [
      { item: breakdown.frontierRelevance, coefficient: 0.65 },
      { item: breakdown.capabilityImpact, coefficient: 0.55 },
    ],
  );
  const practicalRelevance = buildMappedScoreItem(
    "practicalRelevance",
    weights.practicalRelevance,
    [
      { item: breakdown.capabilityImpact, coefficient: 0.2 },
      { item: breakdown.realWorldImpact, coefficient: 0.7 },
    ],
  );
  const evidenceCredibility = buildMappedScoreItem(
    "evidenceCredibility",
    weights.evidenceCredibility,
    [{ item: breakdown.evidenceStrength, coefficient: 0.85 }],
  );
  const tldrAccessibility = buildMappedScoreItem(
    "tldrAccessibility",
    weights.tldrAccessibility,
    [
      { item: breakdown.frontierRelevance, coefficient: 0.15 },
      { item: breakdown.capabilityImpact, coefficient: 0.25 },
      { item: breakdown.realWorldImpact, coefficient: 0.1 },
      { item: breakdown.evidenceStrength, coefficient: 0.15 },
      { item: breakdown.audiencePull, coefficient: 0.35 },
    ],
  );

  return {
    audienceInterest,
    frontierRelevance,
    practicalRelevance,
    evidenceCredibility,
    tldrAccessibility,
  };
}

export function defaultReasonForVisibleComponent(
  key: ExecutiveScoreComponentKey,
  rawScore: number,
) {
  const { label } = EXECUTIVE_SCORE_COMPONENT_METADATA[key];

  if (rawScore >= 75) {
    return `${label} is a strong signal in the title and abstract.`;
  }

  if (rawScore >= 50) {
    return `${label} appears meaningfully in the paper framing.`;
  }

  return `${label} is present but not dominant in the abstract.`;
}

function normalizeToPreviousVisibleBreakdown(
  breakdown: ScoreBreakdown<string>,
): PreviousVisibleExecutiveScoreBreakdown {
  const hasPreviousVisibleBreakdown = PREVIOUS_VISIBLE_EXECUTIVE_SCORE_COMPONENTS.every(
    (key) => breakdown[key],
  );

  if (hasPreviousVisibleBreakdown) {
    return Object.fromEntries(
      PREVIOUS_VISIBLE_EXECUTIVE_SCORE_COMPONENTS.map((key) => {
        const item = breakdown[key] as ScoreBreakdownItem<string>;
        return [
          key,
          buildPreviousVisibleScoreItem(
            key,
            item.rawScore,
            item.weight,
            item.reason,
            item.weightedScore,
          ),
        ];
      }),
    ) as PreviousVisibleExecutiveScoreBreakdown;
  }

  const legacyFrontier = readLegacyItem(breakdown, "frontierRelevance");
  const legacyCapability = readLegacyItem(breakdown, "capabilityImpact");
  const legacyEvidence = readLegacyItem(breakdown, "evidenceStrength");
  const legacyClarity = readLegacyItem(breakdown, "claritySignal");
  const legacyRealWorldItems = LEGACY_REAL_WORLD_KEYS.map((key) =>
    readLegacyItem(breakdown, key),
  ).filter(Boolean) as ScoreBreakdownItem<LegacyExecutiveScoreComponentKey>[];

  const realWorldAverage =
    legacyRealWorldItems.reduce((sum, item) => sum + item.rawScore, 0) /
      Math.max(legacyRealWorldItems.length, 1);
  const strongestRealWorldSignal =
    [...legacyRealWorldItems].sort((left, right) => right.rawScore - left.rawScore)[0] ??
    null;
  const realWorldRawScore = clamp(
    round(
      (strongestRealWorldSignal?.rawScore ?? 0) * 0.6 + realWorldAverage * 0.4,
    ),
  );
  const audiencePullRawScore = clamp(
    round(
      (legacyClarity?.rawScore ?? 0) * 0.45 +
        (legacyFrontier?.rawScore ?? 0) * 0.35 +
        (readLegacyItem(breakdown, "strategicBusinessImpact")?.rawScore ?? 0) * 0.2,
    ),
  );

  return {
    frontierRelevance: buildPreviousVisibleScoreItem(
      "frontierRelevance",
      legacyFrontier?.rawScore ?? 0,
      legacyFrontier?.weight ?? 0,
      legacyFrontier?.reason ??
        "Frontier relevance is a strong signal in the older scoring model.",
      legacyFrontier?.weightedScore,
    ),
    capabilityImpact: buildPreviousVisibleScoreItem(
      "capabilityImpact",
      legacyCapability?.rawScore ?? 0,
      legacyCapability?.weight ?? 0,
      legacyCapability?.reason ??
        "Capability impact appears meaningfully in the older scoring model.",
      legacyCapability?.weightedScore,
    ),
    realWorldImpact: buildPreviousVisibleScoreItem(
      "realWorldImpact",
      realWorldRawScore,
      legacyRealWorldItems.reduce((sum, item) => sum + item.weight, 0),
      strongestRealWorldSignal?.reason ??
        "Real-world impact is a meaningful signal in the older scoring model.",
    ),
    evidenceStrength: buildPreviousVisibleScoreItem(
      "evidenceStrength",
      legacyEvidence?.rawScore ?? 0,
      legacyEvidence?.weight ?? 0,
      legacyEvidence?.reason ??
        "Evidence strength appears meaningfully in the older scoring model.",
      legacyEvidence?.weightedScore,
    ),
    audiencePull: buildPreviousVisibleScoreItem(
      "audiencePull",
      audiencePullRawScore,
      legacyClarity?.weight ?? 0,
      legacyClarity?.reason ??
        "Audience pull appears meaningfully in the older scoring model.",
    ),
  };
}

function buildMappedScoreItem(
  key: ExecutiveScoreComponentKey,
  weight: number,
  sources: Array<{
    item: ScoreBreakdownItem<string>;
    coefficient: number;
  }>,
): ScoreBreakdownItem<ExecutiveScoreComponentKey> {
  const rawScore = clamp(
    round(weightedAverage(sources.map(({ item, coefficient }) => [item.rawScore, coefficient]))),
  );
  const strongestReason = pickStrongestReason(sources);

  return buildVisibleScoreItem(
    key,
    rawScore,
    weight,
    strongestReason ?? defaultReasonForVisibleComponent(key, rawScore),
  );
}

function buildVisibleScoreItem(
  key: ExecutiveScoreComponentKey,
  rawScore: number,
  weight: number,
  reason: string,
  weightedScore?: number,
): ScoreBreakdownItem<ExecutiveScoreComponentKey> {
  return {
    key,
    label: EXECUTIVE_SCORE_COMPONENT_METADATA[key].label,
    rawScore: clamp(rawScore),
    weight,
    weightedScore:
      typeof weightedScore === "number"
        ? weightedScore
        : round(clamp(rawScore) * weight),
    reason,
  };
}

function buildPreviousVisibleScoreItem(
  key: PreviousVisibleExecutiveScoreComponentKey,
  rawScore: number,
  weight: number,
  reason: string,
  weightedScore?: number,
): ScoreBreakdownItem<PreviousVisibleExecutiveScoreComponentKey> {
  return {
    key,
    label: key,
    rawScore: clamp(rawScore),
    weight,
    weightedScore:
      typeof weightedScore === "number"
        ? weightedScore
        : round(clamp(rawScore) * weight),
    reason,
  };
}

function weightedAverage(entries: Array<[number, number]>) {
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  return entries.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
}

function pickStrongestReason(
  sources: Array<{
    item: ScoreBreakdownItem<string>;
    coefficient: number;
  }>,
) {
  return [...sources]
    .sort(
      (left, right) =>
        right.item.rawScore * right.coefficient - left.item.rawScore * left.coefficient,
    )[0]
    ?.item.reason;
}

function readLegacyItem(
  breakdown: ScoreBreakdown<string>,
  key: LegacyExecutiveScoreComponentKey,
) {
  const item = breakdown[key];
  if (!item) {
    return null;
  }

  return item as ScoreBreakdownItem<LegacyExecutiveScoreComponentKey>;
}
