import type { PaperSourceRecord, StructuredTechnicalBrief } from "@/lib/types";
import { demoTechnicalBriefFixtures } from "../../../data/mock/demo-technical-briefs";

export class MockTechnicalBriefProvider {
  readonly provider = "mock";
  readonly extractionModel = "demo-fixture";
  readonly synthesisModel = "demo-fixture";

  isAvailable() {
    return true;
  }

  resolveModel(usePremiumSynthesis: boolean) {
    void usePremiumSynthesis;
    return this.synthesisModel;
  }

  async generate(
    paper: PaperSourceRecord,
    input?: unknown,
  ): Promise<StructuredTechnicalBrief> {
    void input;
    const fixture = demoTechnicalBriefFixtures.find((item) => item.arxivId === paper.arxivId);

    if (!fixture) {
      throw new Error(`No mock technical brief exists for ${paper.arxivId}.`);
    }

    return fixture.brief;
  }
}
