import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  compareArticlesResponseSchema,
  compareArticlesV2InputSchema,
  discoverArticlesInputSchema,
  discoverArticlesResponseSchema,
  openArticleInputSchema,
  openArticleResponseSchema,
  summarizeTopArticlesInputSchema,
  summarizeTopArticlesResponseSchema,
  type CompareArticlesV2Input,
  type DiscoverArticlesInput,
  type OpenArticleInput,
  type SummarizeTopArticlesInput,
} from "@repo-types/content";
import { env } from "@/lib/env";
import {
  errorToolResult,
  handleCompareArticles,
  handleDiscoverArticles,
  handleOpenArticle,
  handleSummarizeTopArticles,
  type McpRequestContext,
  successToolResult,
} from "@/lib/mcp/tool-handlers";

export function createReadAbstractedMcpServer(context: McpRequestContext = {}) {
  const server = new McpServer({
    name: "readabstracted-mcp",
    version: "0.1.0",
    websiteUrl: resolveWebsiteUrl(context.requestOrigin),
    description: "Read-only MCP access to ReadAbstracted article discovery, lookup, search, and comparison.",
  });

  server.registerTool(
    "summarize_top_articles",
    {
      title: "Summarize the ReadAbstracted weekly edition",
      description:
        "Returns the curated ReadAbstracted weekly edition that mirrors the website homepage, including editorial framing and the curated article order.",
      inputSchema: summarizeTopArticlesInputSchema,
      outputSchema: summarizeTopArticlesResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: SummarizeTopArticlesInput) => {
      try {
        const payload = await handleSummarizeTopArticles(input, context);
        return successToolResult(
          `Returned ${payload.articles.length} articles from the ReadAbstracted weekly edition.`,
          payload,
        );
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "discover_articles",
    {
      title: "Discover ReadAbstracted articles",
      description:
        "Searches or browses the wider ReadAbstracted archive, returning opinionated context, provenance, and discovery-specific match information.",
      inputSchema: discoverArticlesInputSchema,
      outputSchema: discoverArticlesResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: DiscoverArticlesInput) => {
      try {
        const payload = await handleDiscoverArticles(input, context);
        return successToolResult(
          `Returned ${payload.results.length} discovered ReadAbstracted articles.`,
          payload,
        );
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "open_article",
    {
      title: "Open a ReadAbstracted article",
      description:
        "Opens one ReadAbstracted article by canonical article reference and returns the canonical article object with opinionated context and provenance.",
      inputSchema: openArticleInputSchema,
      outputSchema: openArticleResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: OpenArticleInput) => {
      try {
        const payload = await handleOpenArticle(input, context);
        return successToolResult(`Opened ${payload.article.title}.`, payload);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "compare_articles",
    {
      title: "Compare ReadAbstracted articles",
      description:
        "Builds a structured comparison across two to five ReadAbstracted articles, including a deterministic recommendation and tradeoff summary.",
      inputSchema: compareArticlesV2InputSchema,
      outputSchema: compareArticlesResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: CompareArticlesV2Input) => {
      try {
        const payload = await handleCompareArticles(input, context);
        return successToolResult(
          `Prepared a structured comparison for ${payload.articles.length} ReadAbstracted articles.`,
          payload,
        );
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  return server;
}

export async function handleReadAbstractedMcpPost(
  request: Request,
  context: McpRequestContext = {},
) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createReadAbstractedMcpServer(context);

  try {
    await server.connect(transport);
    const parsedBody = await parseRequestBody(request);
    return await transport.handleRequest(
      request,
      typeof parsedBody === "undefined" ? undefined : { parsedBody },
    );
  } catch (error) {
    return createJsonRpcErrorResponse(
      error instanceof SyntaxError ? 400 : 500,
      error instanceof SyntaxError ? -32700 : -32603,
      error instanceof Error ? error.message : "Internal MCP server error.",
    );
  }
}

export function createMethodNotAllowedMcpResponse() {
  return createJsonRpcErrorResponse(405, -32000, "Method not allowed. Use POST /api/mcp.", {
    allow: "POST",
  });
}

function resolveWebsiteUrl(requestOrigin?: string) {
  if (env.SITE_BASE_URL) {
    return env.SITE_BASE_URL;
  }

  if (requestOrigin) {
    return requestOrigin.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

async function parseRequestBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return request.json();
}

function createJsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
  options?: { allow?: string },
) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: null,
    }),
    {
      status,
      headers: {
        "content-type": "application/json",
        ...(options?.allow ? { allow: options.allow } : {}),
      },
    },
  );
}
