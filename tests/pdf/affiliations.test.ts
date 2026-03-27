import { describe, expect, it } from "vitest";
import { extractPdfAffiliationPayloadFromPages } from "@/lib/pdf/affiliations";

describe("extractPdfAffiliationPayloadFromPages", () => {
  it("parses numbered institutions from the first page", () => {
    const payload = extractPdfAffiliationPayloadFromPages([
      {
        pageNumber: 1,
        text: "MetaClaw : Just Talk - An Agent That Meta-Learns and Evolves in the Wild Peng Xia 1*, Jianwen Chen 1*, Xinyu Yang 2*, Haoqin Tu 3*, Zeyu Zheng 4, Huaxiu Yao 1* 1 UNC-Chapel Hill, 2 Carnegie Mellon University, 3 UC Santa Cruz, 4 UC Berkeley, * Core Contributors Abstract Large language model agents are increasingly used...",
      },
    ]);

    expect(payload?.institutions.map((institution) => institution.displayName)).toEqual([
      "UNC-Chapel Hill",
      "Carnegie Mellon University",
      "UC Santa Cruz",
      "UC Berkeley",
    ]);
    expect(payload?.extractedFromPage).toBe(1);
  });

  it("returns null when no institution section is detected", () => {
    const payload = extractPdfAffiliationPayloadFromPages([
      {
        pageNumber: 1,
        text: "A short note with authors only and no affiliation markers before the abstract.",
      },
    ]);

    expect(payload).toBeNull();
  });
});
