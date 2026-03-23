import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  discoverArticlesContentMock,
  getArticleContentMock,
  getTopArticlesContentMock,
} = vi.hoisted(() => ({
  discoverArticlesContentMock: vi.fn(),
  getArticleContentMock: vi.fn(),
  getTopArticlesContentMock: vi.fn(),
}));

vi.mock("@/lib/content/service", () => ({
  discoverArticlesContent: discoverArticlesContentMock,
  getArticleContent: getArticleContentMock,
  getTopArticlesContent: getTopArticlesContentMock,
}));

import {
  errorToolResult,
  handleCompareArticles,
  handleDiscoverArticles,
  handleOpenArticle,
  handleSummarizeTopArticles,
  successToolResult,
} from "@/lib/mcp/tool-handlers";

const articleDetail = {
  id: "paper-1",
  arxivId: "2603.08852",
  title: "Agent Handoff Protocols",
  subtitle: "Why the handoff layer matters now.",
  canonicalUrl: "https://readabstracted.com/papers/paper-1",
  arxivUrl: "https://arxiv.org/abs/2603.08852",
  abstractUrl: "https://arxiv.org/abs/2603.08852",
  publishedAt: "2026-03-18T15:00:00.000Z",
  announcementDay: "2026-03-18",
  weekStart: "2026-03-16",
  authors: ["Alice A."],
  categories: ["cs.AI"],
  topics: ["agent systems", "protocol design", "infra"],
  tags: ["cs.AI", "agents", "infra"],
  analysis: {
    thesis: "A production-oriented paper about multi-agent routing.",
    whyItMatters: "Routing and provenance are becoming product surfaces.",
    topicTags: ["agents", "infra", "protocol design"],
    methodType: "agent system",
    evidenceStrength: "medium" as const,
    likelyAudience: ["builders", "pms"] as const,
    caveats: ["The abstract-only layer may miss deployment trade-offs."],
    noveltyScore: 73,
    businessRelevanceScore: 88,
    sourceBasis: "editorial" as const,
  },
  ranking: {
    totalScore: 92,
    rationale: "High platform relevance.",
  },
  summarySnippet: "The handoff layer is becoming a platform bottleneck.",
  pdfAvailability: {
    hasPdfUrl: true,
    hasExtractedText: true,
    extractionStatus: "EXTRACTED" as const,
    usedFallbackAbstract: false,
    pageCount: 12,
    fileSizeBytes: 12000,
  },
  abstract: "This paper studies protocol design for multi-agent systems.",
  bestAvailableText: "This paper studies protocol design for multi-agent systems.",
  technicalBrief: {
    oneLineVerdict: "The handoff layer is becoming a platform bottleneck.",
    whyItMatters: "Routing and provenance are becoming product surfaces.",
    whatToIgnore: "This is not proof every multi-agent deployment wins.",
    focusTags: ["agents", "infra"],
    confidenceNotes: ["The strategic read is partly inferred from the setup."],
    keyStats: [],
    bullets: [],
    evidence: [
      {
        claim: "The paper grounds agent routing in operational protocol design.",
        impactArea: "stack" as const,
        confidence: "high" as const,
        citations: [],
      },
    ],
    sourceBasis: "full-pdf" as const,
    usedFallbackAbstract: false,
  },
  sourceReferences: [
    {
      label: "ReadAbstracted article",
      kind: "readabstracted" as const,
      sourceUrl: "https://readabstracted.com/papers/paper-1",
    },
  ],
};

const articleSummary = {
  id: articleDetail.id,
  arxivId: articleDetail.arxivId,
  title: articleDetail.title,
  subtitle: articleDetail.subtitle,
  canonicalUrl: articleDetail.canonicalUrl,
  arxivUrl: articleDetail.arxivUrl,
  abstractUrl: articleDetail.abstractUrl,
  publishedAt: articleDetail.publishedAt,
  announcementDay: articleDetail.announcementDay,
  weekStart: articleDetail.weekStart,
  authors: articleDetail.authors,
  categories: articleDetail.categories,
  topics: articleDetail.topics,
  tags: articleDetail.tags,
  analysis: articleDetail.analysis,
  ranking: articleDetail.ranking,
  summarySnippet: articleDetail.summarySnippet,
  pdfAvailability: articleDetail.pdfAvailability,
};

describe("mcp tool handlers", () => {
  beforeEach(() => {
    discoverArticlesContentMock.mockReset();
    getArticleContentMock.mockReset();
    getTopArticlesContentMock.mockReset();
  });

  it("opens articles by falling back from internal id to arxiv id", async () => {
    getArticleContentMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        article: articleDetail,
      });

    const payload = await handleOpenArticle({
      article_ref: articleDetail.arxivId,
      verbosity: "standard",
    });

    expect(getArticleContentMock).toHaveBeenNthCalledWith(
      1,
      { article_id: articleDetail.arxivId },
      {},
    );
    expect(getArticleContentMock).toHaveBeenNthCalledWith(
      2,
      { arxiv_id: articleDetail.arxivId },
      {},
    );
    expect(payload.article.provenance.groundingTier).toBe("editorial");
    expect(payload.article.content.abstract).toBe(articleDetail.abstract);
  });

  it("accepts full arxiv abstract urls as article refs", async () => {
    getArticleContentMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        article: articleDetail,
      });

    const payload = await handleOpenArticle({
      article_ref: "https://arxiv.org/abs/2603.08852v1",
      verbosity: "standard",
    });

    expect(getArticleContentMock).toHaveBeenNthCalledWith(
      1,
      { url: "https://arxiv.org/abs/2603.08852v1" },
      {},
    );
    expect(getArticleContentMock).toHaveBeenNthCalledWith(
      2,
      { arxiv_id: "https://arxiv.org/abs/2603.08852v1" },
      {},
    );
    expect(payload.article.id).toBe(articleDetail.id);
  });

  it("returns not found details for unresolved article refs", async () => {
    getArticleContentMock.mockResolvedValue(null);

    await expect(
      handleOpenArticle({
        article_ref: "missing-ref",
        verbosity: "standard",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      status: 404,
      details: {
        requestedRef: "missing-ref",
      },
    });
  });

  it("summarizes the weekly edition with canonical article payloads", async () => {
    getTopArticlesContentMock
      .mockResolvedValueOnce({
        weekStart: "2026-03-16",
        topic: null,
        limit: 10,
        articles: [articleSummary],
      })
      .mockResolvedValueOnce({
        weekStart: "2026-03-16",
        topic: null,
        limit: 1,
        articles: [articleSummary],
      });

    const payload = await handleSummarizeTopArticles({
      limit: 10,
      verbosity: "standard",
    });

    expect(payload.edition.editionType).toBe("readabstracted_weekly");
    expect(payload.edition.isLive).toBe(true);
    expect(payload.articles[0]?.article.analysis.quickTake).toBe(articleSummary.subtitle);
  });

  it("preserves discovery-only metadata on discover responses", async () => {
    discoverArticlesContentMock.mockResolvedValue({
      mode: "search",
      query: "robotics",
      topic: null,
      audience: null,
      sort: "relevance",
      weekStart: null,
      startDate: "2026-03-01",
      endDate: "2026-03-22",
      limit: 10,
      results: [
        {
          article: articleDetail,
          discovery: {
            rank: 1,
            sort: "relevance",
            matchedOn: ["title", "taxonomy"],
            matchReason: "Exact title phrase match.",
            matchSnippet: articleDetail.summarySnippet,
          },
        },
      ],
    });

    const payload = await handleDiscoverArticles({
      query: "robotics",
      limit: 10,
      verbosity: "standard",
    });

    expect(payload.mode).toBe("search");
    expect(payload.results[0]?.discovery.matchReason).toBe("Exact title phrase match.");
    expect(payload.results[0]?.article.content.abstract).toBeNull();
  });

  it("builds structured comparison payloads with a deterministic recommendation", async () => {
    getArticleContentMock
      .mockResolvedValueOnce({ article: articleDetail })
      .mockResolvedValueOnce({
        article: {
          ...articleDetail,
          id: "paper-2",
          title: "Inference Budget Controls",
          canonicalUrl: "https://readabstracted.com/papers/paper-2",
          arxivId: "2603.08938",
          arxivUrl: "https://arxiv.org/abs/2603.08938",
          abstractUrl: "https://arxiv.org/abs/2603.08938",
          ranking: {
            totalScore: 81,
            rationale: "Useful but narrower.",
          },
          analysis: {
            ...articleDetail.analysis,
            sourceBasis: "abstract_only" as const,
            likelyAudience: ["builders", "investors"] as const,
          },
          technicalBrief: null,
          sourceReferences: [
            {
              label: "ReadAbstracted article",
              kind: "readabstracted" as const,
              sourceUrl: "https://readabstracted.com/papers/paper-2",
            },
          ],
        },
      });

    const payload = await handleCompareArticles({
      article_refs: ["paper-1", "paper-2"],
      question: "Which one is better for builders?",
      verbosity: "standard",
    });

    expect(payload.comparison.recommendedWinner).toBe("paper-1");
    expect(payload.comparison.bestFor).toBe("builders");
    expect(payload.comparison.provenanceByArticle[1]?.groundingTier).toBe("abstract");
  });

  it("returns structured error payloads", () => {
    const payload = errorToolResult(new Error("Unexpected failure"));

    expect(payload.isError).toBe(true);
    expect(payload.structuredContent).toEqual({
      error: {
        type: "internal_error",
        message: "Unexpected failure",
        status: 500,
      },
    });
  });

  it("wraps successful payloads for MCP results", () => {
    const payload = successToolResult("Returned 0 discovered articles.", {
      schemaVersion: "2" as const,
      mode: "browse" as const,
      query: null,
      topic: null,
      audience: null,
      sort: "editorial" as const,
      weekStart: null,
      startDate: null,
      endDate: null,
      limit: 10,
      results: [],
    });

    expect(payload.structuredContent.results).toEqual([]);
    expect(payload.content[0]?.text).toBe("Returned 0 discovered articles.");
  });
});
