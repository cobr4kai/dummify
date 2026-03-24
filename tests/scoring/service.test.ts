import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENAI_RANKING_WEIGHTS,
  DEFAULT_HIGH_BUSINESS_RELEVANCE_THRESHOLD,
} from "@/config/defaults";
import { computeBriefScore } from "@/lib/scoring/service";

describe("computeBriefScore", () => {
  it("produces a transparent weighted breakdown for frontier-brief ranking", () => {
    const score = computeBriefScore(
      {
        title:
          "Open-Source Protocol for Cost-Aware Agentic Search in Enterprise Workflows",
        abstract:
          "We introduce a reference implementation for agentic retrieval in enterprise workflows. The system improves latency, budget control, governance, and verification while offering practical guidance for production deployment.",
        categories: ["cs.AI", "cs.IR"],
      },
      DEFAULT_GENAI_RANKING_WEIGHTS,
    );

    const breakdownTotal = Object.values(score.breakdown).reduce(
      (sum, item) => sum + item.weightedScore,
      0,
    );

    expect(score.totalScore).toBeCloseTo(breakdownTotal, 5);
    expect(score.breakdown.frontierRelevance.weight).toBe(
      DEFAULT_GENAI_RANKING_WEIGHTS.frontierRelevance,
    );
    expect(score.breakdown.practicalRelevance.rawScore).toBeGreaterThanOrEqual(45);
    expect(score.breakdown.audienceInterest.rawScore).toBeGreaterThanOrEqual(45);
    expect(score.rationale.length).toBeGreaterThan(20);
  });

  it("uses the new five-criterion default weight model", () => {
    expect(DEFAULT_GENAI_RANKING_WEIGHTS.audienceInterest).toBe(0.28);
    expect(DEFAULT_GENAI_RANKING_WEIGHTS.frontierRelevance).toBe(0.26);
    expect(DEFAULT_GENAI_RANKING_WEIGHTS.practicalRelevance).toBe(0.22);
    expect(DEFAULT_GENAI_RANKING_WEIGHTS.evidenceCredibility).toBe(0.16);
    expect(DEFAULT_GENAI_RANKING_WEIGHTS.tldrAccessibility).toBe(0.08);
    expect(DEFAULT_GENAI_RANKING_WEIGHTS.audienceInterest).toBeGreaterThan(
      DEFAULT_GENAI_RANKING_WEIGHTS.tldrAccessibility,
    );
    expect(
      Object.values(DEFAULT_GENAI_RANKING_WEIGHTS).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(1, 5);
  });

  it("preserves score transparency for weaker, more conceptual papers", () => {
    const score = computeBriefScore({
      title: "A Novel Theoretical Lens on Representation Learning",
      abstract:
        "We propose a new theoretical analysis of representation collapse under simplified assumptions and discuss open mathematical questions.",
      categories: ["stat.ML"],
    });

    expect(score.totalScore).toBeGreaterThan(0);
    expect(score.breakdown.audienceInterest.rawScore).toBeLessThanOrEqual(60);
    expect(score.frontierRelevanceScore).toBeLessThan(
      DEFAULT_HIGH_BUSINESS_RELEVANCE_THRESHOLD,
    );
  });

  it("rewards explicit evidence when two papers are otherwise similarly relevant", () => {
    const quantified = computeBriefScore({
      title: "Inference Acceleration for Multimodal Generative Models",
      abstract:
        "We report benchmark comparisons, ablations, and a 22% latency reduction for multimodal generative inference with no meaningful quality loss.",
      categories: ["cs.LG", "cs.CV"],
    });

    const vague = computeBriefScore({
      title: "Inference Acceleration for Multimodal Generative Models",
      abstract:
        "We discuss a promising approach for faster multimodal generative inference and outline qualitative benefits.",
      categories: ["cs.LG", "cs.CV"],
    });

    expect(quantified.breakdown.evidenceCredibility.rawScore).toBeGreaterThan(
      vague.breakdown.evidenceCredibility.rawScore,
    );
    expect(quantified.totalScore).toBeGreaterThan(vague.totalScore);
  });

  it("rewards papers cross-listed across the core operator feeds", () => {
    const singleFeed = computeBriefScore({
      title: "Agent Evaluation for Enterprise Task Routing",
      abstract:
        "We study agent evaluation, workflow reliability, and deployment trade-offs for enterprise task routing systems.",
      categories: ["cs.AI", "cs.LG"],
      sourceFeedCategories: ["cs.AI"],
    });

    const crossListed = computeBriefScore({
      title: "Agent Evaluation for Enterprise Task Routing",
      abstract:
        "We study agent evaluation, workflow reliability, and deployment trade-offs for enterprise task routing systems.",
      categories: ["cs.AI", "cs.LG"],
      sourceFeedCategories: ["cs.AI", "cs.LG", "cs.CL"],
    });

    expect(crossListed.breakdown.frontierRelevance.rawScore).toBeGreaterThan(
      singleFeed.breakdown.frontierRelevance.rawScore,
    );
    expect(crossListed.totalScore).toBeGreaterThan(singleFeed.totalScore);
  });

  it("only applies institution priors when optional enrichment metadata is present", () => {
    const withoutMetadata = computeBriefScore({
      title: "Inference Acceleration for Multimodal Generative Models",
      abstract:
        "We report benchmark comparisons and a 22% latency reduction for multimodal inference.",
      categories: ["cs.LG"],
    });

    const withMetadata = computeBriefScore({
      title: "Inference Acceleration for Multimodal Generative Models",
      abstract:
        "We report benchmark comparisons and a 22% latency reduction for multimodal inference.",
      categories: ["cs.LG"],
      sourceMetadata: {
        institutionSignals: ["Anthropic", "OpenAI"],
      },
    });

    expect(withoutMetadata.breakdown.practicalRelevance.rawScore).toBeLessThan(
      withMetadata.breakdown.practicalRelevance.rawScore,
    );
  });

  it("rewards topics with natural business-reader relevance through audience interest", () => {
    const highPull = computeBriefScore({
      title: "Agent Workflows for Enterprise Knowledge Work",
      abstract:
        "We show how agent workflows reduce handoff friction in enterprise search, automate parts of knowledge work, and improve deployment readiness for production assistants.",
      categories: ["cs.AI", "cs.MA"],
    });

    const lowPull = computeBriefScore({
      title: "Asymptotic Properties of a New Loss Function",
      abstract:
        "We analyze theorem-level convergence properties of a loss function under simplified assumptions and discuss narrow technical edge cases.",
      categories: ["stat.ML"],
    });

    expect(highPull.breakdown.audienceInterest.rawScore).toBeGreaterThan(
      lowPull.breakdown.audienceInterest.rawScore,
    );
    expect(highPull.totalScore).toBeGreaterThan(lowPull.totalScore);
  });
});
