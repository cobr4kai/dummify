import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  browseArticlesContentMock,
  getArticleContentMock,
  openArticleContentMock,
  suggestArticleRefsMock,
  getTopArticlesContentMock,
  searchArticlesContentMock,
} = vi.hoisted(() => ({
  browseArticlesContentMock: vi.fn(),
  getArticleContentMock: vi.fn(),
  openArticleContentMock: vi.fn(),
  suggestArticleRefsMock: vi.fn(),
  getTopArticlesContentMock: vi.fn(),
  searchArticlesContentMock: vi.fn(),
}));

vi.mock("@/lib/content/service", () => ({
  browseArticlesContent: browseArticlesContentMock,
  getArticleContent: getArticleContentMock,
  openArticleContent: openArticleContentMock,
  suggestArticleRefs: suggestArticleRefsMock,
  getTopArticlesContent: getTopArticlesContentMock,
  searchArticlesContent: searchArticlesContentMock,
}));

import { GET as getArticleRoute } from "@/app/api/content/article/route";
import { GET as getBrowseRoute } from "@/app/api/content/browse/route";
import { GET as getOpenRoute } from "@/app/api/content/open/route";
import { GET as getSearchRoute } from "@/app/api/content/search/route";
import { GET as getTopRoute } from "@/app/api/content/top/route";

describe("content API routes", () => {
  beforeEach(() => {
    browseArticlesContentMock.mockReset();
    getArticleContentMock.mockReset();
    openArticleContentMock.mockReset();
    suggestArticleRefsMock.mockReset();
    getTopArticlesContentMock.mockReset();
    searchArticlesContentMock.mockReset();
  });

  it("returns top articles payloads", async () => {
    getTopArticlesContentMock.mockResolvedValue({
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

    const response = await getTopRoute(new Request("https://example.com/api/content/top?limit=10"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
  });

  it("returns not found envelopes for missing articles", async () => {
    getArticleContentMock.mockResolvedValue(null);
    suggestArticleRefsMock.mockResolvedValue([]);

    const response = await getArticleRoute(
      new Request("https://example.com/api/content/article?article_id=missing"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "not_found",
        message: "Article not found.",
        details: {
          requestedRef: "missing",
          normalizedRef: "missing",
          suggestions: [],
          supportedVerbosity: ["quick", "standard", "deep"],
        },
      },
    });
  });

  it("returns validation errors for malformed search requests", async () => {
    const response = await getSearchRoute(
      new Request("https://example.com/api/content/search?query="),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Too small: expected string to have >=1 characters",
        details: expect.any(Array),
      },
    });
  });

  it("returns browse payloads without requiring a topic", async () => {
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

    const response = await getBrowseRoute(new Request("https://example.com/api/content/browse"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
  });

  it("returns structured suggestions for missing open lookups", async () => {
    openArticleContentMock.mockResolvedValue(null);
    suggestArticleRefsMock.mockResolvedValue([
      {
        articleRef: "paper-1",
        title: "Agent Handoff Protocols",
        canonicalUrl: "https://readabstracted.com/papers/paper-1",
        arxivId: "2603.08852",
        reason: "Matched an arXiv identifier.",
      },
    ]);

    const response = await getOpenRoute(
      new Request("https://example.com/api/content/open?article_ref=2603.08852v1"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "not_found",
        message: "Article not found.",
        details: {
          requestedRef: "2603.08852v1",
          normalizedRef: "2603.08852v1",
          suggestions: [
            {
              articleRef: "paper-1",
              title: "Agent Handoff Protocols",
              canonicalUrl: "https://readabstracted.com/papers/paper-1",
              arxivId: "2603.08852",
              reason: "Matched an arXiv identifier.",
            },
          ],
          supportedVerbosity: ["quick", "standard", "deep"],
        },
      },
    });
  });
});
