import { describe, expect, it } from "vitest";
import { chunkPdfPages } from "@/lib/pdf/service";

describe("chunkPdfPages", () => {
  it("preserves page order and does not drop pages when chunking", () => {
    const pages = [
      { pageNumber: 1, text: "A".repeat(30) },
      { pageNumber: 2, text: "B".repeat(20) },
      { pageNumber: 3, text: "C".repeat(25) },
    ];

    const chunks = chunkPdfPages(pages, 45);

    expect(chunks).toHaveLength(2);
    expect(chunks.flat().map((page) => page.pageNumber)).toEqual([1, 2, 3]);
    expect(chunks[0]?.map((page) => page.pageNumber)).toEqual([1]);
    expect(chunks[1]?.map((page) => page.pageNumber)).toEqual([2, 3]);
  });
});
