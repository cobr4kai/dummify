import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content/service", () => ({
  discoverArticlesContent: async () => ({
    mode: "browse",
    query: null,
    topic: null,
    audience: null,
    sort: "editorial",
    weekStart: null,
    startDate: null,
    endDate: null,
    limit: 10,
    results: [],
  }),
  getArticleContent: async () => null,
  getTopArticlesContent: async () => ({
    weekStart: null,
    topic: null,
    limit: 10,
    articles: [],
  }),
}));

import { DELETE, GET, POST } from "@/app/api/mcp/route";

const PROTOCOL_VERSION = "2025-11-25";

describe("mcp route", () => {
  it("returns method not allowed for GET", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed. Use POST /api/mcp.",
      },
      id: null,
    });
  });

  it("returns method not allowed for DELETE", async () => {
    const response = await DELETE();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("initializes over POST", async () => {
    const response = await POST(
      new Request("https://example.com/api/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-protocol-version": PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.result.serverInfo.name).toBe("readabstracted-mcp");
    expect(payload.result.capabilities.tools).toBeDefined();
  });

  it("lists the new canonical tool surface", async () => {
    const response = await POST(
      new Request("https://example.com/api/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-protocol-version": PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const toolNames = payload.result.tools.map((tool: { name: string }) => tool.name);
    expect(toolNames).toEqual([
      "summarize_top_articles",
      "discover_articles",
      "open_article",
      "compare_articles",
    ]);
  });

  it("returns parse errors for malformed json", async () => {
    const response = await POST(
      new Request("https://example.com/api/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32700,
        message: expect.any(String),
      },
      id: null,
    });
  });
});
