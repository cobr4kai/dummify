import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findPaperMock,
  getEnrichmentProvidersMock,
  transactionMock,
  updateManyMock,
  createMock,
  paperUpdateMock,
} = vi.hoisted(() => ({
  findPaperMock: vi.fn(),
  getEnrichmentProvidersMock: vi.fn(),
  transactionMock: vi.fn(),
  updateManyMock: vi.fn(),
  createMock: vi.fn(),
  paperUpdateMock: vi.fn(),
}));

vi.mock("@/lib/providers", () => ({
  getEnrichmentProviders: getEnrichmentProvidersMock,
  getTechnicalBriefProvider: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    paper: {
      findUnique: findPaperMock,
      update: paperUpdateMock,
    },
    $transaction: transactionMock,
  },
}));

import { ensurePaperEnrichment } from "@/lib/ingestion/service";

const basePaper = {
  id: "paper-1",
  arxivId: "2603.08877",
  version: 1,
  versionedId: "2603.08877v1",
  title: "Demo paper",
  abstract: "Demo abstract",
  authorsJson: ["Ada Lovelace"],
  authorsText: "Ada Lovelace",
  categoriesJson: ["cs.AI"],
  sourceFeedCategoriesJson: ["cs.AI"],
  categoryText: "cs.AI",
  primaryCategory: "cs.AI",
  publishedAt: new Date("2026-03-11T00:00:00.000Z"),
  updatedAt: new Date("2026-03-11T00:00:00.000Z"),
  announcementDay: "2026-03-11",
  announceType: "demo",
  comment: null,
  journalRef: null,
  doi: null,
  abstractUrl: "https://arxiv.org/abs/2603.08877",
  pdfUrl: null,
  links: { abs: "https://arxiv.org/abs/2603.08877" },
  sourceMetadata: { sourceType: "demo" },
  sourcePayload: { note: "fixture" },
  technicalBriefs: [],
  enrichments: [],
  publishedItems: [],
};

describe("ensurePaperEnrichment", () => {
  beforeEach(() => {
    findPaperMock.mockReset();
    getEnrichmentProvidersMock.mockReset();
    transactionMock.mockReset();
    updateManyMock.mockReset();
    createMock.mockReset();
    paperUpdateMock.mockReset();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        paperEnrichment: {
          updateMany: updateManyMock,
          create: createMock,
        },
      }),
    );
  });

  it("reuses the current enrichment by default", async () => {
    const enrichMock = vi.fn();
    getEnrichmentProvidersMock.mockReturnValue([
      {
        provider: "openalex",
        enrich: enrichMock,
      },
    ]);
    findPaperMock.mockResolvedValue({
      ...basePaper,
      enrichments: [
        {
          provider: "openalex",
          payload: {
            topics: ["agents"],
            matchedBy: "title_author",
            institutions: [
              {
                displayName: "OpenAI",
                countryCode: "US",
                type: "company",
                authorCount: 1,
                isCorresponding: false,
              },
            ],
            authorships: [
              {
                authorName: "Ada Lovelace",
                institutionNames: ["OpenAI"],
                isCorresponding: false,
              },
            ],
          },
          isCurrent: true,
        },
      ],
    });

    const result = await ensurePaperEnrichment("paper-1");

    expect(result).toBe(false);
    expect(enrichMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("refreshes enrichment when forced and updates search text for structured metadata", async () => {
    const enrichMock = vi.fn().mockResolvedValue({
      provider: "structured_metadata_v1",
      providerRecordId: null,
      payload: {
        version: "structured_metadata_v1",
        sourceBasis: "abstract_only",
        thesis: "A demo thesis about agent infrastructure.",
        whyItMatters: "This matters for builders evaluating agent runtime systems.",
        topicTags: ["agents", "infra"],
        methodType: "agent system",
        evidenceStrength: "medium",
        likelyAudience: ["builders"],
        caveats: ["The abstract does not establish production reliability on its own."],
        noveltyScore: 61,
        businessRelevanceScore: 74,
        searchText: "demo thesis agent infrastructure builders",
        generationMode: "hybrid",
      },
    });
    getEnrichmentProvidersMock.mockReturnValue([
      {
        provider: "structured_metadata_v1",
        enrich: enrichMock,
      },
    ]);
    findPaperMock.mockResolvedValue({
      ...basePaper,
      searchText: "demo abstract",
      enrichments: [],
    });
    updateManyMock.mockResolvedValue({ count: 0 });
    createMock.mockResolvedValue({ id: "enrichment-2" });
    paperUpdateMock.mockResolvedValue({ id: "paper-1" });

    const result = await ensurePaperEnrichment("paper-1", { force: true });

    expect(result).toBe(true);
    expect(enrichMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(paperUpdateMock).toHaveBeenCalledWith({
      where: { id: "paper-1" },
      data: {
        searchText: expect.stringContaining("demo thesis agent infrastructure builders"),
      },
    });
  });

  it("refreshes stale openalex enrichments that predate institution tracking", async () => {
    const enrichMock = vi.fn().mockResolvedValue({
      provider: "openalex",
      providerRecordId: "https://openalex.org/W1",
      payload: {
        displayName: "Demo paper",
        citedByCount: 4,
        topics: ["agents"],
        relatedWorks: [],
        matchedBy: "arxiv_url",
        institutions: [
          {
            displayName: "OpenAI",
            countryCode: "US",
            type: "company",
            authorCount: 1,
            isCorresponding: false,
          },
        ],
        authorships: [
          {
            authorName: "Ada Lovelace",
            institutionNames: ["OpenAI"],
            isCorresponding: false,
          },
        ],
      },
    });
    getEnrichmentProvidersMock.mockReturnValue([
      {
        provider: "openalex",
        enrich: enrichMock,
      },
    ]);
    findPaperMock.mockResolvedValue({
      ...basePaper,
      searchText: "demo abstract",
      enrichments: [
        {
          provider: "openalex",
          payload: { topics: ["agents"] },
          isCurrent: true,
        },
      ],
    });
    updateManyMock.mockResolvedValue({ count: 1 });
    createMock.mockResolvedValue({ id: "enrichment-3" });
    paperUpdateMock.mockResolvedValue({ id: "paper-1" });

    const result = await ensurePaperEnrichment("paper-1");

    expect(result).toBe(true);
    expect(enrichMock).toHaveBeenCalledTimes(1);
    expect(paperUpdateMock).toHaveBeenCalledWith({
      where: { id: "paper-1" },
      data: {
        searchText: expect.stringContaining("openai"),
      },
    });
  });
});
