import type { PaperSourceRecord, StructuredPaperSummary } from "@/lib/types";
import { demoPaperFixtures } from "../../../data/mock/demo-fixtures";

export class MockSummaryProvider {
  readonly provider = "mock";
  readonly model = "demo-fixture";

  isAvailable() {
    return true;
  }

  async generate(paper: PaperSourceRecord): Promise<StructuredPaperSummary> {
    const fixture = demoPaperFixtures.find(
      (item) => item.paper.arxivId === paper.arxivId,
    );

    if (!fixture) {
      throw new Error(`No mock summary exists for ${paper.arxivId}.`);
    }

    return fixture.summary;
  }
}
