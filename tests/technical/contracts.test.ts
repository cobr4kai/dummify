import { describe, expect, it } from "vitest";
import { demoPaperFixtures } from "../../data/mock/demo-fixtures";
import { demoTechnicalBriefFixtures } from "../../data/mock/demo-technical-briefs";
import { MockTechnicalBriefProvider } from "@/lib/providers/mock-technical-provider";
import { normalizeTechnicalBriefLead } from "@/lib/technical/brief-text";
import {
  buildTechnicalBriefSystemPrompt,
  buildTechnicalBriefUserPrompt,
} from "@/lib/technical/prompts";
import {
  normalizeHookText,
  resolveTechnicalSynthesisModel,
} from "@/lib/providers/openai-technical-provider";
import {
  chunkEvidenceSchema,
  technicalBriefSchema,
} from "@/lib/technical/schema";

describe("technical brief contracts", () => {
  it("accepts the seeded executive brief schema", () => {
    const parsed = technicalBriefSchema.parse(demoTechnicalBriefFixtures[0].brief);

    expect(parsed.oneLineVerdict).toContain("orchestration");
    expect(parsed.bullets.length).toBeGreaterThanOrEqual(3);
    expect(parsed.bullets.length).toBeLessThanOrEqual(5);
    expect(parsed.keyStats[0]?.citations[0]?.page).toBeGreaterThan(0);
  });

  it("accepts structured chunk evidence payloads", () => {
    const parsed = chunkEvidenceSchema.parse({
      summary:
        "The chunk shows measured inference efficiency gains and explicit latency tradeoffs for serving larger multimodal models.",
      findings: [
        {
          claim: "Latency decreases materially after distillation.",
          impactArea: "inference",
          confidence: "high",
          citations: [{ page: 4, section: "Latency table", quote: null }],
        },
      ],
      metrics: [
        {
          label: "Throughput",
          value: "+18%",
          context: "Operators may be able to serve the same workload with fewer accelerators.",
          citations: [{ page: 4, section: null, quote: null }],
        },
      ],
      limitations: ["Results are measured only on the authors' benchmark stack."],
    });

    expect(parsed.findings[0]?.impactArea).toBe("inference");
    expect(parsed.metrics[0]?.citations[0]?.page).toBe(4);
  });

  it("serves mock executive briefs for demo fixtures", async () => {
    const provider = new MockTechnicalBriefProvider();
    const brief = await provider.generate(demoPaperFixtures[0].paper, {
      pages: [],
      sourceBasis: "abstract-fallback",
      usePremiumSynthesis: false,
    });

    expect(provider.isAvailable()).toBe(true);
    expect(provider.resolveModel(false)).toBe("demo-fixture");
    expect(brief.bullets.length).toBeGreaterThanOrEqual(3);
    expect(brief.bullets.length).toBeLessThanOrEqual(5);
    expect(brief.bullets.some((bullet) => bullet.impactArea === "vendor-question")).toBe(
      true,
    );
    expect(brief.whyItMatters).toContain("orchestration");
  });

  it("guides the live brief prompt toward a simple business-reader structure", () => {
    const prompt = buildTechnicalBriefUserPrompt(
      demoPaperFixtures[0].paper,
      [],
      "abstract-fallback",
    );

    expect(buildTechnicalBriefSystemPrompt()).toContain(
      "Produce only two reader-facing elements",
    );
    expect(buildTechnicalBriefSystemPrompt()).toContain("3-5 bullets");
    expect(prompt).toContain("2-4 sentence");
    expect(prompt).toContain("Do not invent extra sections or audience tabs");
    expect(prompt).toContain("what to ask");
  });

  it("falls back to the extraction model when premium synthesis is disabled", () => {
    expect(resolveTechnicalSynthesisModel(true)).toBe("gpt-5.4");
    expect(resolveTechnicalSynthesisModel(false)).toBe("gpt-5-mini");
  });

  it("trims incomplete hooks back to a complete sentence", () => {
    const hook =
      "Multi-agent AI often wastes time and money in the handoff layer. This paper offers a credible protocol fix, but the evidence is mixed because the flashy";

    expect(normalizeHookText(hook)).toBe(
      "Multi-agent AI often wastes time and money in the handoff layer.",
    );
  });

  it("strips leaked markdown headings from verdict text", () => {
    const hook = "## Why this is worth your attention\n\nThis paper argues the hard part is orchestration, not model quality.";

    expect(normalizeTechnicalBriefLead(hook)).toBe(
      "This paper argues the hard part is orchestration, not model quality.",
    );
    expect(normalizeHookText(hook)).toBe(
      "This paper argues the hard part is orchestration, not model quality.",
    );
  });
});
