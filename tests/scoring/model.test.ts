import { describe, expect, it } from "vitest";
import {
  mapLegacyWeightsToVisible,
  normalizeExecutiveScoreBreakdown,
} from "@/lib/scoring/model";

describe("score model compatibility", () => {
  it("maps legacy weight sets into the visible five-criterion model", () => {
    const mapped = mapLegacyWeightsToVisible({
      frontierRelevance: 0.18,
      capabilityImpact: 0.17,
      trainingEconomicsImpact: 0.08,
      inferenceEconomicsImpact: 0.09,
      platformStackImpact: 0.08,
      strategicBusinessImpact: 0.2,
      evidenceStrength: 0.16,
      claritySignal: 0.04,
    });

    expect(mapped.frontierRelevance).toBe(0.18);
    expect(mapped.capabilityImpact).toBe(0.17);
    expect(mapped.realWorldImpact).toBeCloseTo(0.45, 5);
    expect(mapped.evidenceStrength).toBe(0.16);
    expect(mapped.audiencePull).toBe(0.04);
  });

  it("rolls up legacy stored breakdowns into the new visible score card", () => {
    const normalized = normalizeExecutiveScoreBreakdown({
      frontierRelevance: {
        key: "frontierRelevance",
        label: "User interest",
        rawScore: 74,
        weight: 0.18,
        weightedScore: 13.3,
        reason: "Frontier fit is strong.",
      },
      capabilityImpact: {
        key: "capabilityImpact",
        label: "Capability impact",
        rawScore: 69,
        weight: 0.17,
        weightedScore: 11.7,
        reason: "Capability gains look practical.",
      },
      trainingEconomicsImpact: {
        key: "trainingEconomicsImpact",
        label: "Training economics",
        rawScore: 30,
        weight: 0.08,
        weightedScore: 2.4,
        reason: "Limited training consequence.",
      },
      inferenceEconomicsImpact: {
        key: "inferenceEconomicsImpact",
        label: "Inference economics",
        rawScore: 78,
        weight: 0.09,
        weightedScore: 7,
        reason: "Serving cost and latency matter here.",
      },
      platformStackImpact: {
        key: "platformStackImpact",
        label: "Platform impact",
        rawScore: 66,
        weight: 0.08,
        weightedScore: 5.3,
        reason: "Platform implications are visible.",
      },
      strategicBusinessImpact: {
        key: "strategicBusinessImpact",
        label: "Real-world impact",
        rawScore: 72,
        weight: 0.2,
        weightedScore: 14.4,
        reason: "Workflow and vendor consequences are clear.",
      },
      evidenceStrength: {
        key: "evidenceStrength",
        label: "Proof strength",
        rawScore: 62,
        weight: 0.16,
        weightedScore: 9.9,
        reason: "Comparative evidence is credible.",
      },
      claritySignal: {
        key: "claritySignal",
        label: "Clarity",
        rawScore: 64,
        weight: 0.04,
        weightedScore: 2.6,
        reason: "A business reader can follow the framing.",
      },
    });

    expect(normalized.frontierRelevance.label).toBe("Frontier relevance");
    expect(normalized.realWorldImpact.rawScore).toBeGreaterThan(60);
    expect(normalized.realWorldImpact.reason).toContain("Serving cost");
    expect(normalized.audiencePull.rawScore).toBeGreaterThan(60);
    expect(normalized.audiencePull.label).toBe("Audience pull");
  });
});
