import { describe, expect, it } from "vitest";
import { demoPaperFixtures } from "../../data/mock/demo-fixtures";
import { MockSummaryProvider } from "@/lib/providers/mock-provider";
import {
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
} from "@/lib/summaries/prompts";
import { structuredPaperSummarySchema } from "@/lib/summaries/schema";

describe("summary contracts", () => {
  it("accepts the seeded demo summary schema", () => {
    const parsed = structuredPaperSummarySchema.parse(demoPaperFixtures[0].summary);

    expect(parsed.oneSentenceSummary).toContain("design choices");
    expect(parsed.audienceInterpretations.finance).toContain("cost");
  });

  it("keeps prompts constrained to metadata and abstract inputs", () => {
    const prompt = buildSummaryUserPrompt({
      ...demoPaperFixtures[0].paper,
      links: {
        ...demoPaperFixtures[0].paper.links,
        pdf: "https://arxiv.org/pdf/2603.08877v1",
      },
      sourcePayload: {
        internalOnly: "do-not-leak",
      },
    });

    expect(buildSummarySystemPrompt()).toContain("Use ONLY the provided title, abstract");
    expect(prompt).toContain("Abstract URL:");
    expect(prompt).not.toContain("https://arxiv.org/pdf/2603.08877v1");
    expect(prompt).not.toContain("do-not-leak");
  });

  it("serves mock summaries for demo fixtures", async () => {
    const provider = new MockSummaryProvider();
    const summary = await provider.generate(demoPaperFixtures[1].paper);

    expect(provider.isAvailable()).toBe(true);
    expect(summary.whatThisIsNot).toContain("not a universal proof");
    expect(summary.maturityEstimate).toBe("INFRA_PLATFORM_RELEVANT");
  });
});
