import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getWeeklyBriefMock,
  paperFindFirstMock,
  paperFindManyMock,
  paperFindUniqueMock,
  papers,
} = vi.hoisted(() => {
  const now = new Date("2026-03-21T12:00:00.000Z");

  const paperOne = {
    id: "paper-1",
    arxivId: "2603.08852",
    version: 1,
    versionedId: "2603.08852v1",
    title: "Agent Handoff Protocols",
    abstract:
      "This paper studies protocol design for multi-agent systems and shows latency improvements from identity-aware routing.",
    authorsJson: ["Alice A.", "Bob B."],
    authorsText: "Alice A., Bob B.",
    categoriesJson: ["cs.AI", "cs.SE"],
    sourceFeedCategoriesJson: ["cs.AI"],
    categoryText: "cs.AI cs.SE",
    primaryCategory: "cs.AI",
    publishedAt: new Date("2026-03-18T15:00:00.000Z"),
    updatedAt: new Date("2026-03-18T15:00:00.000Z"),
    announcementDay: "2026-03-18",
    announceType: null,
    comment: null,
    journalRef: null,
    doi: null,
    abstractUrl: "https://arxiv.org/abs/2603.08852",
    pdfUrl: "https://arxiv.org/pdf/2603.08852.pdf",
    links: {},
    sourceMetadata: {},
    sourcePayload: {},
    searchText:
      "agent handoff protocols multi agent systems latency routing identity aware protocol",
    isDemoData: false,
    firstSeenAt: now,
    lastSeenAt: now,
    createdAt: now,
    recordUpdatedAt: now,
    scores: [
      {
        totalScore: 92,
        rationale: "High platform relevance.",
      },
    ],
    technicalBriefs: [
      {
        oneLineVerdict:
          "Why this is worth your attention This paper argues the handoff layer is becoming a real platform bottleneck for multi-agent systems.",
        keyStatsJson: [
          {
            label: "Latency",
            value: "Lower",
            context: "Identity-aware routing lowered latency in the reported setup.",
            citations: [{ page: 4, section: "Latency table", quote: "not for redistribution" }],
          },
        ],
        focusTagsJson: ["agents", "infra"],
        whyItMatters:
          "Teams building agent systems may need to compete on routing, provenance, and trust boundaries.",
        whatToIgnore:
          "This is not proof that multi-agent systems automatically improve end-user quality.",
        executiveTakeaway: "",
        bulletsJson: [
          {
            label: "Vendor question",
            text: "Ask vendors what their agent handoff protocol exposes about routing, provenance, and control.",
            impactArea: "vendor-question",
            citations: [{ page: 5, section: "Routing", quote: "hidden quote" }],
          },
        ],
        performanceImpact: "",
        trainingImpact: "",
        inferenceImpact: "",
        limitationsJson: [],
        confidenceNotesJson: ["The strategic read is partly inferred from the evaluation setup."],
        evidenceJson: [
          {
            claim: "Identity-aware routing lowered latency on easier tasks.",
            impactArea: "inference",
            confidence: "high",
            citations: [{ page: 6, section: "Results", quote: "do not surface" }],
          },
        ],
        provider: "openai",
        model: "gpt-5.4",
        sourceBasis: "full-pdf",
        usedFallbackAbstract: false,
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    pdfCaches: [
      {
        sourceUrl: "https://arxiv.org/pdf/2603.08852.pdf",
        filePath: "/var/data/paper-1.pdf",
        extractedJsonPath: "/var/data/paper-1.pages.json",
        fileSizeBytes: 12345,
        pageCount: 12,
        extractionStatus: "EXTRACTED",
        extractionError: null,
        usedFallbackAbstract: false,
        fetchedAt: now,
        extractedAt: now,
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    enrichments: [
      {
        provider: "openalex",
        payload: {
          topics: ["agent systems", "protocol design"],
        },
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  const paperTwo = {
    ...paperOne,
    id: "paper-2",
    arxivId: "2603.08938",
    versionedId: "2603.08938v1",
    title: "Inference Budget Controls",
    abstract:
      "This paper looks at inference budget controls and retrieval tuning rather than agent protocols.",
    authorsJson: ["Cara C."],
    authorsText: "Cara C.",
    categoriesJson: ["cs.LG"],
    sourceFeedCategoriesJson: ["cs.LG"],
    categoryText: "cs.LG",
    primaryCategory: "cs.LG",
    abstractUrl: "https://arxiv.org/abs/2603.08938",
    pdfUrl: "https://arxiv.org/pdf/2603.08938.pdf",
    searchText: "inference budget controls retrieval tuning cost quality",
    scores: [
      {
        totalScore: 81,
        rationale: "Useful but narrower.",
      },
    ],
    technicalBriefs: [
      {
        ...paperOne.technicalBriefs[0],
        oneLineVerdict:
          "This paper suggests small inference-budget controls may improve search quality before costs rise too far.",
        focusTagsJson: ["inference", "infra"],
        whyItMatters:
          "Budget instrumentation may deliver better returns than blindly moving to a larger model tier.",
        bulletsJson: [
          {
            label: "Implication",
            text: "Search-heavy products may get better returns from retrieval tuning than from bigger default models.",
            impactArea: "implication",
            citations: [{ page: 7, section: "Ablation grid", quote: null }],
          },
        ],
        evidenceJson: [
          {
            claim: "A modest increase in search depth improved answer quality.",
            impactArea: "capability",
            confidence: "high",
            citations: [{ page: 7, section: "Main results", quote: null }],
          },
        ],
      },
    ],
    pdfCaches: [
      {
        ...paperOne.pdfCaches[0],
        sourceUrl: "https://arxiv.org/pdf/2603.08938.pdf",
      },
    ],
    enrichments: [
      {
        ...paperOne.enrichments[0],
        payload: {
          topics: ["retrieval tuning", "inference controls"],
        },
      },
    ],
  };

  return {
    getWeeklyBriefMock: vi.fn(),
    paperFindFirstMock: vi.fn(),
    paperFindManyMock: vi.fn(),
    paperFindUniqueMock: vi.fn(),
    papers: { paperOne, paperTwo },
  };
});

vi.mock("@/lib/search/service", () => ({
  getWeeklyBrief: getWeeklyBriefMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    paper: {
      findFirst: paperFindFirstMock,
      findMany: paperFindManyMock,
      findUnique: paperFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    SITE_BASE_URL: "https://readabstracted.com",
  },
}));

import {
  getArticleContent,
  getTopArticlesContent,
  resolvePaperIdFromLookup,
  searchArticlesContent,
} from "@/lib/content/service";

describe("content service", () => {
  beforeEach(() => {
    getWeeklyBriefMock.mockReset();
    paperFindFirstMock.mockReset();
    paperFindManyMock.mockReset();
    paperFindUniqueMock.mockReset();
  });

  it("preserves curated ordering for top articles", async () => {
    getWeeklyBriefMock.mockResolvedValue({
      weekStart: "2026-03-16",
      papers: [{ id: "paper-2" }, { id: "paper-1" }],
    });
    paperFindManyMock.mockResolvedValue([papers.paperOne, papers.paperTwo]);

    const result = await getTopArticlesContent({
      week: "2026-03-18",
      limit: 2,
      topic: undefined,
    });

    expect(result.weekStart).toBe("2026-03-16");
    expect(result.articles.map((article) => article.id)).toEqual(["paper-2", "paper-1"]);
    expect(result.articles[0]?.canonicalUrl).toBe("https://readabstracted.com/papers/paper-2");
  });

  it("resolves by url and redacts quote text plus cache paths", async () => {
    paperFindUniqueMock.mockResolvedValue(papers.paperOne);

    const result = await getArticleContent({
      article_id: undefined,
      url: "https://readabstracted.com/papers/paper-1",
      arxiv_id: undefined,
    });

    expect(result?.article.id).toBe("paper-1");
    expect(result?.article.technicalBrief?.keyStats[0]?.citations[0]).toEqual({
      page: 4,
      section: "Latency table",
      sourceUrl: "https://arxiv.org/pdf/2603.08852.pdf",
    });
    expect(result?.article.pdfAvailability).toEqual({
      hasPdfUrl: true,
      hasExtractedText: true,
      extractionStatus: "EXTRACTED",
      usedFallbackAbstract: false,
      pageCount: 12,
      fileSizeBytes: 12345,
    });
    expect(result?.article.sourceReferences.some((reference) => "quote" in reference)).toBe(false);
    expect(result?.article.bestAvailableText).not.toContain("not for redistribution");
  });

  it("resolves paper ids from canonical paper paths and arxiv ids", async () => {
    paperFindFirstMock.mockResolvedValue({ id: "paper-1" });

    await expect(
      resolvePaperIdFromLookup({
        article_id: undefined,
        url: "/papers/paper-1",
        arxiv_id: undefined,
      }),
    ).resolves.toBe("paper-1");

    await expect(
      resolvePaperIdFromLookup({
        article_id: undefined,
        url: undefined,
        arxiv_id: "https://arxiv.org/abs/2603.08852v1",
      }),
    ).resolves.toBe("paper-1");
  });

  it("scores article search results deterministically", async () => {
    paperFindManyMock.mockResolvedValue([papers.paperTwo, papers.paperOne]);

    const result = await searchArticlesContent({
      query: "agent protocol",
      topic: undefined,
      week: undefined,
      start_date: undefined,
      end_date: undefined,
      limit: 5,
    });

    expect(result.results[0]?.id).toBe("paper-1");
    expect(result.results[0]?.matchedFields).toContain("title");
    expect(result.results[0]?.matchedFields).toContain("technicalBrief");
    expect(result.results[0]?.snippet.toLowerCase()).toContain("handoff");
    expect(result.results[0]?.relevanceScore).toBeGreaterThan(result.results[1]?.relevanceScore ?? 0);
  });
});
