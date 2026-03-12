import { describe, expect, it } from "vitest";
import {
  getHomepageBriefState,
  hasPdfBackedBrief,
  prioritizePapersWithPdfBackedBriefs,
} from "@/lib/technical/brief-status";

describe("technical brief homepage status", () => {
  it("treats only non-fallback briefs as homepage-ready", () => {
    expect(hasPdfBackedBrief([{ usedFallbackAbstract: false }])).toBe(true);
    expect(hasPdfBackedBrief([{ usedFallbackAbstract: true }])).toBe(false);
    expect(getHomepageBriefState([{ usedFallbackAbstract: true }])).toBe(
      "abstract-fallback",
    );
    expect(getHomepageBriefState([])).toBe("missing");
  });

  it("prioritizes papers with PDF-backed briefs while preserving relative order", () => {
    const papers = [
      { id: "fallback-first", technicalBriefs: [{ usedFallbackAbstract: true }] },
      { id: "pdf-one", technicalBriefs: [{ usedFallbackAbstract: false }] },
      { id: "missing", technicalBriefs: [] },
      { id: "pdf-two", technicalBriefs: [{ usedFallbackAbstract: false }] },
    ];

    expect(
      prioritizePapersWithPdfBackedBriefs(papers).map((paper) => paper.id),
    ).toEqual(["pdf-one", "pdf-two", "fallback-first", "missing"]);
  });
});
