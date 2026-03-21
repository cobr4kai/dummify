import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getArticleContentMock,
  getTopArticlesContentMock,
  searchArticlesContentMock,
} = vi.hoisted(() => ({
  getArticleContentMock: vi.fn(),
  getTopArticlesContentMock: vi.fn(),
  searchArticlesContentMock: vi.fn(),
}));

vi.mock("@/lib/content/service", () => ({
  getArticleContent: getArticleContentMock,
  getTopArticlesContent: getTopArticlesContentMock,
  searchArticlesContent: searchArticlesContentMock,
}));

import { GET as getArticleRoute } from "@/app/api/content/article/route";
import { GET as getSearchRoute } from "@/app/api/content/search/route";
import { GET as getTopRoute } from "@/app/api/content/top/route";

describe("content API routes", () => {
  beforeEach(() => {
    getArticleContentMock.mockReset();
    getTopArticlesContentMock.mockReset();
    searchArticlesContentMock.mockReset();
  });

  it("returns top articles payloads", async () => {
    getTopArticlesContentMock.mockResolvedValue({
      weekStart: "2026-03-16",
      topic: null,
      limit: 10,
      articles: [],
    });

    const response = await getTopRoute(new Request("https://example.com/api/content/top?limit=10"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      weekStart: "2026-03-16",
      topic: null,
      limit: 10,
      articles: [],
    });
  });

  it("returns not found envelopes for missing articles", async () => {
    getArticleContentMock.mockResolvedValue(null);

    const response = await getArticleRoute(
      new Request("https://example.com/api/content/article?article_id=missing"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "not_found",
        message: "Article not found.",
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
      },
    });
  });
});
