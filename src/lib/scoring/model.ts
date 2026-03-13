import { z } from "zod";
import {
  EXECUTIVE_SCORE_COMPONENTS,
  type ExecutiveScoreBreakdown,
  type ExecutiveScoreComponentKey,
  type ExecutiveScoringWeights,
  type ScoreBreakdown,
  type ScoreBreakdownItem,
} from "@/lib/types";
import { clamp, round } from "@/lib/utils/strings";

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
  frontierRelevance: {
    label: "Frontier relevance",
    shortLabel: "Frontier",
    description:
      "Directly targets modern frontier-model, multimodal, agentic, or deployment-relevant AI systems.",
  },
  capabilityImpact: {
    label: "Capability impact",
    shortLabel: "Capability",
    description:
      "Claims a meaningful change in what AI systems can do or how well they perform.",
  },
  realWorldImpact: {
    label: "Real-world impact",
    shortLabel: "Real-world",
    description:
      "Could materially affect cost, deployment, workflow automation, productization, or business decision-making.",
  },
  evidenceStrength: {
    label: "Evidence strength",
    shortLabel: "Evidence",
    description:
      "Includes credible comparative evidence, benchmark structure, or support strong enough to take the claim seriously.",
  },
  audiencePull: {
    label: "Audience pull",
    shortLabel: "Audience",
    description:
      "Addresses a topic that smart non-research readers are likely to care about immediately, not just technical specialists.",
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

export function mapLegacyWeightsToVisible(
  weights: LegacyExecutiveScoringWeights,
): ExecutiveScoringWeights {
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
    frontierRelevance: buildVisibleScoreItem(
      "frontierRelevance",
      legacyFrontier?.rawScore ?? 0,
      legacyFrontier?.weight ?? 0,
      legacyFrontier?.reason ??
        defaultReasonForVisibleComponent("frontierRelevance", legacyFrontier?.rawScore ?? 0),
      legacyFrontier?.weightedScore,
    ),
    capabilityImpact: buildVisibleScoreItem(
      "capabilityImpact",
      legacyCapability?.rawScore ?? 0,
      legacyCapability?.weight ?? 0,
      legacyCapability?.reason ??
        defaultReasonForVisibleComponent("capabilityImpact", legacyCapability?.rawScore ?? 0),
      legacyCapability?.weightedScore,
    ),
    realWorldImpact: buildVisibleScoreItem(
      "realWorldImpact",
      realWorldRawScore,
      legacyRealWorldItems.reduce((sum, item) => sum + item.weight, 0),
      strongestRealWorldSignal?.reason ??
        defaultReasonForVisibleComponent("realWorldImpact", realWorldRawScore),
    ),
    evidenceStrength: buildVisibleScoreItem(
      "evidenceStrength",
      legacyEvidence?.rawScore ?? 0,
      legacyEvidence?.weight ?? 0,
      legacyEvidence?.reason ??
        defaultReasonForVisibleComponent("evidenceStrength", legacyEvidence?.rawScore ?? 0),
      legacyEvidence?.weightedScore,
    ),
    audiencePull: buildVisibleScoreItem(
      "audiencePull",
      audiencePullRawScore,
      legacyClarity?.weight ?? 0,
      legacyClarity?.reason ??
        defaultReasonForVisibleComponent("audiencePull", audiencePullRawScore),
    ),
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
