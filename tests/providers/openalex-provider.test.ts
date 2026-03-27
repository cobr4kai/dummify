import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaperSourceRecord } from "@/lib/types";

vi.mock("@/lib/env", () => ({
  env: {
    OPENALEX_API_KEY: "test-openalex-key",
  },
}));

import { OpenAlexProvider } from "@/lib/providers/openalex-provider";

const fetchMock = vi.fn();

const basePaper: PaperSourceRecord = {
  arxivId: "1706.03762",
  version: 1,
  versionedId: "1706.03762v1",
  title: "Attention Is All You Need",
  abstract: "A transformer paper.",
  authors: ["Ashish Vaswani", "Noam Shazeer"],
  categories: ["cs.CL"],
  sourceFeedCategories: ["cs.CL"],
  primaryCategory: "cs.CL",
  publishedAt: new Date("2017-06-12T00:00:00.000Z"),
  updatedAt: new Date("2017-06-12T00:00:00.000Z"),
  announcementDay: "2017-06-12",
  comment: null,
  journalRef: null,
  doi: null,
  links: {
    abs: "https://arxiv.org/abs/1706.03762v1",
    pdf: "https://arxiv.org/pdf/1706.03762v1.pdf",
  },
  sourceMetadata: {},
  sourcePayload: {},
};

describe("OpenAlexProvider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers identifier matches and aggregates institution counts", async () => {
    fetchMock
      .mockResolvedValueOnce(
        okJson({
          results: [
            {
              id: "https://openalex.org/W1",
              display_name: "Attention Is All You Need",
              cited_by_count: 6500,
              topics: [{ display_name: "Natural Language Processing Techniques" }],
              related_works: ["https://openalex.org/W2"],
              locations: [{ landing_page_url: "http://arxiv.org/abs/1706.03762" }],
              authorships: [
                {
                  author: { display_name: "Ashish Vaswani" },
                  is_corresponding: true,
                  institutions: [
                    {
                      id: "https://openalex.org/I1",
                      display_name: "Google (United States)",
                      ror: "https://ror.org/00njsd438",
                      country_code: "US",
                      type: "company",
                    },
                  ],
                },
                {
                  author: { display_name: "Noam Shazeer" },
                  institutions: [
                    {
                      id: "https://openalex.org/I1",
                      display_name: "Google (United States)",
                      ror: "https://ror.org/00njsd438",
                      country_code: "US",
                      type: "company",
                    },
                  ],
                },
              ],
            },
          ],
        }),
      );

    const provider = new OpenAlexProvider();
    const result = await provider.enrich(basePaper, {
      paperId: "paper-1",
      announcementDay: basePaper.announcementDay,
      isEditorial: false,
      hasPdfBackedBrief: false,
      currentOpenAlexTopics: [],
      currentEnrichments: [],
    });

    expect(result?.payload.matchedBy).toBe("doi");
    expect(result?.payload.institutions).toEqual([
      {
        id: "https://openalex.org/I1",
        displayName: "Google (United States)",
        ror: "https://ror.org/00njsd438",
        countryCode: "US",
        type: "company",
        authorCount: 2,
        isCorresponding: true,
      },
    ]);
    expect(result?.payload.authorships).toEqual([
      {
        authorName: "Ashish Vaswani",
        institutionNames: ["Google (United States)"],
        isCorresponding: true,
      },
      {
        authorName: "Noam Shazeer",
        institutionNames: ["Google (United States)"],
        isCorresponding: false,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("filter=doi%3A");
  });

  it("falls back to title and author matching when direct identifiers miss", async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ results: [] }))
      .mockResolvedValueOnce(okJson({ results: [] }))
      .mockResolvedValueOnce(
        okJson({
          results: [
            {
              id: "https://openalex.org/W1",
              display_name: "Attention Is All You Need",
              publication_year: 2017,
              cited_by_count: 6500,
              topics: [],
              related_works: [],
              authorships: [
                {
                  author: { display_name: "Ashish Vaswani" },
                  institutions: [],
                },
              ],
            },
          ],
        }),
      );

    const provider = new OpenAlexProvider();
    const result = await provider.enrich(basePaper, {
      paperId: "paper-1",
      announcementDay: basePaper.announcementDay,
      isEditorial: false,
      hasPdfBackedBrief: false,
      currentOpenAlexTopics: [],
      currentEnrichments: [],
    });

    expect(result?.payload.matchedBy).toBe("title_author");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("search=Attention+Is+All+You+Need");
  });

  it("returns null for fuzzy title matches without enough support", async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ results: [] }))
      .mockResolvedValueOnce(okJson({ results: [] }))
      .mockResolvedValueOnce(
        okJson({
          results: [
            {
              id: "https://openalex.org/W9",
              display_name: "Attention and Routing in Large Language Models",
              publication_year: 2024,
              cited_by_count: 12,
              authorships: [
                {
                  author: { display_name: "Someone Else" },
                  institutions: [],
                },
              ],
            },
          ],
        }),
      );

    const provider = new OpenAlexProvider();
    const result = await provider.enrich(basePaper, {
      paperId: "paper-1",
      announcementDay: basePaper.announcementDay,
      isEditorial: false,
      hasPdfBackedBrief: false,
      currentOpenAlexTopics: [],
      currentEnrichments: [],
    });

    expect(result).toBeNull();
  });
});

function okJson(payload: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(payload),
  };
}
