import { describe, expect, it } from "vitest";
import {
  mapLegacyWeightsToVisible,
  mapPreviousVisibleWeightsToVisible,
  normalizeExecutiveScoreBreakdown,
} from "@/lib/scoring/model";

describe("score model compatibility", () => {
  it("maps legacy weight sets into the new five-criterion model", () => {
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

    expect(mapped.frontierRelevance).toBeGreaterThan(0.18);
    expect(mapped.practicalRelevance).toBeGreaterThan(0.2);
    expect(mapped.evidenceCredibility).toBeGreaterThan(0.1);
    expect(mapped.tldrAccessibility).toBeGreaterThan(0.05);
    expect(
      Object.values(mapped).reduce((sum, value) => sum + value, 0),
    ).toBeGreaterThan(0.8);
  });

  it("maps the previous visible weight model into the new component set", () => {
    const mapped = mapPreviousVisibleWeightsToVisible({
      frontierRelevance: 0.26,
      capabilityImpact: 0.22,
      realWorldImpact: 0.24,
      evidenceStrength: 0.12,
      audiencePull: 0.16,
    });

    expect(mapped.audienceInterest).toBeGreaterThan(0.18);
    expect(mapped.frontierRelevance).toBeGreaterThan(0.25);
    expect(mapped.practicalRelevance).toBeGreaterThan(0.18);
    expect(mapped.evidenceCredibility).toBeCloseTo(0.102, 3);
    expect(mapped.tldrAccessibility).toBeGreaterThan(0.15);
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
    expect(normalized.practicalRelevance.rawScore).toBeGreaterThan(60);
    expect(normalized.practicalRelevance.reason).toContain("Serving cost");
    expect(normalized.audienceInterest.rawScore).toBeGreaterThan(60);
    expect(normalized.audienceInterest.label).toBe("Audience interest");
    expect(normalized.tldrAccessibility.rawScore).toBeGreaterThan(55);
  });
});
