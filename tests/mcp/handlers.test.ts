import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  browseArticlesContentMock,
  getArticleContentMock,
  getArticlesForComparisonMock,
  getTopArticlesContentMock,
  openArticleContentMock,
  resolveArticleReferenceMock,
  searchArticlesContentMock,
  suggestArticleRefsMock,
} = vi.hoisted(() => ({
  browseArticlesContentMock: vi.fn(),
  getArticleContentMock: vi.fn(),
  getArticlesForComparisonMock: vi.fn(),
  getTopArticlesContentMock: vi.fn(),
  openArticleContentMock: vi.fn(),
  resolveArticleReferenceMock: vi.fn(),
  searchArticlesContentMock: vi.fn(),
  suggestArticleRefsMock: vi.fn(),
}));

vi.mock("@/lib/content/service", () => ({
  browseArticlesContent: browseArticlesContentMock,
  getArticleContent: getArticleContentMock,
  getArticlesForComparison: getArticlesForComparisonMock,
  getTopArticlesContent: getTopArticlesContentMock,
  openArticleContent: openArticleContentMock,
  resolveArticleReference: resolveArticleReferenceMock,
  searchArticlesContent: searchArticlesContentMock,
  suggestArticleRefs: suggestArticleRefsMock,
}));

import {
  errorToolResult,
  handleBrowseArticles,
  handleCompareArticles,
  handleGetArticle,
  handleListTopArticles,
  handleOpenArticle,
  handleSearchArticles,
  successToolResult,
} from "@/lib/mcp/tool-handlers";

const articleOne = {
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
    mode: "editorial" as const,
    label: "Editorially prioritized this week.",
    score: 92,
    dimensions: [],
    whyRanked: "High platform relevance.",
    totalScore: 92,
    rationale: "High platform relevance.",
  },
  summarySnippet: "The handoff layer is becoming a platform bottleneck.",
  pdfAvailability: {
    hasPdfUrl: true,
    hasExtractedText: true,
    hasExtractedPdf: true,
    extractionStatus: "EXTRACTED" as const,
    usedFallbackAbstract: false,
    pageCount: 12,
    fileSizeBytes: 12000,
  },
  article: {
    id: "paper-1",
    articleRef: "paper-1",
    arxivId: "2603.08852",
    title: "Agent Handoff Protocols",
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
  },
  summary: {
    preview: "The handoff layer is becoming a platform bottleneck.",
    quickTake: "Why the handoff layer matters now.",
    whyItMatters: "Routing and provenance are becoming product surfaces.",
    whyRanked: "High platform relevance.",
    whyMatched: null,
    abstract: "This paper studies protocol design for multi-agent systems.",
  },
  availability: {
    hasPdfUrl: true,
    hasExtractedText: true,
    hasExtractedPdf: true,
    extractionStatus: "EXTRACTED" as const,
    usedFallbackAbstract: false,
    pageCount: 12,
    fileSizeBytes: 12000,
  },
  discovery: null,
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
    evidence: [],
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

const articleTwo = {
  ...articleOne,
  id: "paper-2",
  arxivId: "2603.08938",
  title: "Inference Budget Controls",
  canonicalUrl: "https://readabstracted.com/papers/paper-2",
  arxivUrl: "https://arxiv.org/abs/2603.08938",
  abstractUrl: "https://arxiv.org/abs/2603.08938",
  publishedAt: "2026-03-20T15:00:00.000Z",
  announcementDay: "2026-03-20",
  ranking: {
    mode: "editorial" as const,
    label: "Editorially prioritized this week.",
    score: 81,
    dimensions: [],
    whyRanked: "Useful but narrower.",
    totalScore: 81,
    rationale: "Useful but narrower.",
  },
  topics: ["inference controls", "protocol design", "infra"],
  tags: ["cs.LG", "inference", "infra"],
  analysis: {
    ...articleOne.analysis,
    thesis: "A paper about retrieval tuning and inference budget controls.",
    topicTags: ["inference", "infra", "retrieval tuning"],
    methodType: "inference or serving method",
    likelyAudience: ["builders", "investors"] as const,
    sourceBasis: "abstract_only" as const,
  },
  technicalBrief: {
    ...articleOne.technicalBrief,
    sourceBasis: "abstract-fallback" as const,
    usedFallbackAbstract: true,
  },
  sourceReferences: [
    {
      label: "ReadAbstracted article",
      kind: "readabstracted" as const,
      sourceUrl: "https://readabstracted.com/papers/paper-2",
    },
  ],
};

describe("mcp tool handlers", () => {
  beforeEach(() => {
    browseArticlesContentMock.mockReset();
    getArticleContentMock.mockReset();
    getArticlesForComparisonMock.mockReset();
    getTopArticlesContentMock.mockReset();
    openArticleContentMock.mockReset();
    resolveArticleReferenceMock.mockReset();
    searchArticlesContentMock.mockReset();
    suggestArticleRefsMock.mockReset();
  });

  it("returns not found for missing article lookups", async () => {
    getArticleContentMock.mockResolvedValue(null);
    suggestArticleRefsMock.mockResolvedValue([]);

    await expect(
      handleGetArticle({
        article_id: "missing",
        url: undefined,
        arxiv_id: undefined,
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      status: 404,
      message: "Article not found.",
    });
  });

  it("uses the new browse/open workflow handlers", async () => {
    browseArticlesContentMock.mockResolvedValue({
      feed: "top",
      query: null,
      topic: null,
      audience: null,
      sort: "editorial",
      weekStart: "2026-03-16",
      startDate: null,
      endDate: null,
      limit: 10,
      hasExtractedPdf: null,
      topicSuggestions: ["agents"],
      articles: [],
    });
    getArticleContentMock.mockResolvedValue({
      requestedRef: "paper-1",
      normalizedRef: "paper-1",
      resolvedBy: "article_ref",
      verbosity: "standard",
      article: articleOne,
    });

    const browsePayload = await handleBrowseArticles({
      limit: 10,
    });
    const openPayload = await handleOpenArticle({
      article_ref: "paper-1",
      verbosity: "standard",
    });

    expect(browsePayload.feed).toBe("top");
    expect(openPayload.article.id).toBe("paper-1");
    expect(openPayload.verbosity).toBe("standard");
  });

  it("builds structured comparison payloads without prose answers", async () => {
    resolveArticleReferenceMock.mockResolvedValue({ paperId: "paper-1" });
    resolveArticleReferenceMock.mockResolvedValueOnce({ paperId: "paper-1" });
    resolveArticleReferenceMock.mockResolvedValueOnce({ paperId: "paper-2" });
    getArticlesForComparisonMock.mockResolvedValue([articleOne, articleTwo]);

    const payload = await handleCompareArticles({
      article_refs: ["paper-1", "paper-2"],
      question: "Which one is stronger on infra platform implications?",
      verbosity: "standard",
    });

    expect(payload.verbosity).toBe("standard");
    expect(payload.articles).toHaveLength(2);
    expect(payload.focusTerms).toContain("infra");
    expect(payload.recommended_winner?.articleId).toBe("paper-1");
    expect(payload.best_for[0]?.reasons.length).toBeGreaterThan(0);
    expect(payload.why).toBeTruthy();
    expect(payload.main_tradeoff).toContain("Agent Handoff Protocols");
    expect(payload.comparison.commonTopics).toContain("protocol design");
    expect(payload.comparison.scoreRanking[0]?.articleId).toBe("paper-1");
    expect(payload.comparison.sourceBasisByArticle[1]?.sourceBasis).toBe("abstract_only");
  });

  it("normalizes MCP top-article inputs through the shared schema", async () => {
    getTopArticlesContentMock.mockResolvedValue({
      feed: "top",
      query: null,
      weekStart: "2026-03-16",
      startDate: null,
      endDate: null,
      topic: "AI",
      audience: null,
      sort: "editorial",
      limit: 10,
      hasExtractedPdf: null,
      topicSuggestions: [],
      articles: [],
    });

    const payload = await handleListTopArticles({
      topic: "AI",
    });

    expect(payload.limit).toBe(10);
    expect(getTopArticlesContentMock).toHaveBeenCalledWith(
      {
        topic: "AI",
        limit: 10,
      },
      {},
    );
  });

  it("normalizes MCP search inputs through the shared schema", async () => {
    searchArticlesContentMock.mockResolvedValue({
      feed: "search",
      query: "AI",
      topic: null,
      audience: null,
      sort: "relevance",
      verbosity: "standard",
      weekStart: null,
      startDate: null,
      endDate: null,
      limit: 5,
      hasExtractedPdf: null,
      topicSuggestions: [],
      results: [],
    });

    const payload = await handleSearchArticles({
      query: "AI",
      limit: 5,
    });

    expect(payload.query).toBe("AI");
    expect(searchArticlesContentMock).toHaveBeenCalledWith(
      {
        query: "AI",
        limit: 5,
      },
      {},
    );
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
    const payload = successToolResult("Returned 0 articles.", {
      feed: "top",
      query: null,
      weekStart: "2026-03-16",
      startDate: null,
      endDate: null,
      topic: null,
      audience: null,
      sort: "editorial",
      limit: 10,
      hasExtractedPdf: null,
      topicSuggestions: [],
      articles: [],
    });

    expect(payload.structuredContent.articles).toEqual([]);
    expect(payload.content[0]?.text).toBe("Returned 0 articles.");
  });
});
