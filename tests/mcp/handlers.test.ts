import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getArticleContentMock,
  getArticlesForComparisonMock,
  getTopArticlesContentMock,
  searchArticlesContentMock,
} = vi.hoisted(() => ({
  getArticleContentMock: vi.fn(),
  getArticlesForComparisonMock: vi.fn(),
  getTopArticlesContentMock: vi.fn(),
  searchArticlesContentMock: vi.fn(),
}));

vi.mock("@/lib/content/service", () => ({
  getArticleContent: getArticleContentMock,
  getArticlesForComparison: getArticlesForComparisonMock,
  getTopArticlesContent: getTopArticlesContentMock,
  searchArticlesContent: searchArticlesContentMock,
}));

import {
  errorToolResult,
  handleCompareArticles,
  handleGetArticle,
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
    totalScore: 81,
    rationale: "Useful but narrower.",
  },
  topics: ["inference controls", "protocol design", "infra"],
  tags: ["cs.LG", "inference", "infra"],
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
    getArticleContentMock.mockReset();
    getArticlesForComparisonMock.mockReset();
    getTopArticlesContentMock.mockReset();
    searchArticlesContentMock.mockReset();
  });

  it("returns not found for missing article lookups", async () => {
    getArticleContentMock.mockResolvedValue(null);

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

  it("builds structured comparison payloads without prose answers", async () => {
    getArticlesForComparisonMock.mockResolvedValue([articleOne, articleTwo]);

    const payload = await handleCompareArticles({
      article_ids: ["paper-1", "paper-2"],
      question: "Which one is stronger on infra platform implications?",
    });

    expect(payload.articles).toHaveLength(2);
    expect(payload.focusTerms).toContain("infra");
    expect(payload.comparison.commonTopics).toContain("protocol design");
    expect(payload.comparison.scoreRanking[0]?.articleId).toBe("paper-1");
    expect(payload.comparison.sourceBasisByArticle[1]?.sourceBasis).toBe("abstract-fallback");
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
      weekStart: "2026-03-16",
      topic: null,
      limit: 10,
      articles: [],
    });

    expect(payload.structuredContent.articles).toEqual([]);
    expect(payload.content[0]?.text).toBe("Returned 0 articles.");
  });
});
