import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  articleComparisonSchema,
  articleResponseSchema,
  browseArticlesResponseSchema,
  searchArticlesResponseSchema,
  topArticlesResponseSchema,
} from "@repo-types/content";
import { env } from "@/lib/env";
import {
  handleBrowseArticles,
  errorToolResult,
  handleCompareArticles,
  handleGetArticle,
  handleListTopArticles,
  handleOpenArticle,
  handleSearchArticles,
  type McpRequestContext,
  successToolResult,
} from "@/lib/mcp/tool-handlers";

const audienceSchema = z.enum(["builders", "researchers", "investors", "pms"]);
const sortSchema = z.enum(["editorial", "relevance", "recency"]);

const mcpBrowseArticlesInputSchema = z.object({
  feed: z.enum(["top", "search"]).optional(),
  query: z.string().trim().min(1).optional(),
  topic: z.string().trim().min(1).optional(),
  audience: audienceSchema.optional(),
  sort: sortSchema.optional(),
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  has_extracted_pdf: z.boolean().optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

const mcpTopArticlesInputSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().min(1).max(25).optional(),
  topic: z.string().trim().min(1).optional(),
  audience: audienceSchema.optional(),
  sort: sortSchema.optional(),
  has_extracted_pdf: z.boolean().optional(),
});

const mcpOpenArticleInputSchema = z.object({
  article_ref: z.string().trim().min(1),
});

const mcpGetArticleInputSchema = z.object({
  article_ref: z.string().trim().min(1).optional(),
  article_id: z.string().trim().min(1).optional(),
  url: z.string().trim().min(1).optional(),
  arxiv_id: z.string().trim().min(1).optional(),
});

const mcpSearchArticlesInputSchema = z.object({
  query: z.string().trim().min(1),
  topic: z.string().trim().min(1).optional(),
  audience: audienceSchema.optional(),
  sort: sortSchema.optional(),
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  has_extracted_pdf: z.boolean().optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

const mcpCompareArticlesInputSchema = z.object({
  article_refs: z.array(z.string().trim().min(1)).min(2).max(5),
  question: z.string().trim().min(1).optional(),
});

type McpBrowseArticlesInput = z.infer<typeof mcpBrowseArticlesInputSchema>;
type McpTopArticlesInput = z.infer<typeof mcpTopArticlesInputSchema>;
type McpOpenArticleInput = z.infer<typeof mcpOpenArticleInputSchema>;
type McpGetArticleInput = z.infer<typeof mcpGetArticleInputSchema>;
type McpSearchArticlesInput = z.infer<typeof mcpSearchArticlesInputSchema>;
type McpCompareArticlesInput = z.infer<typeof mcpCompareArticlesInputSchema>;

export function createReadAbstractedMcpServer(context: McpRequestContext = {}) {
  const server = new McpServer({
    name: "readabstracted-mcp",
    version: "0.1.0",
    websiteUrl: resolveWebsiteUrl(context.requestOrigin),
    description: "Read-only MCP access to ReadAbstracted article discovery, lookup, search, and comparison.",
  });

  server.registerTool(
    "browse_articles",
    {
      title: "Browse ReadAbstracted articles",
      description:
        "Browse top ReadAbstracted papers or search the archive with optional topic, audience, date, and extracted-PDF filters.",
      inputSchema: mcpBrowseArticlesInputSchema,
      outputSchema: browseArticlesResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: McpBrowseArticlesInput) => {
      try {
        const payload = await handleBrowseArticles(input, context);
        return successToolResult(
          `Returned ${payload.articles.length} ReadAbstracted articles for browsing.`,
          payload,
        );
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "list_top_articles",
    {
      title: "List top ReadAbstracted articles",
      description:
        "Returns the current or requested week's top ReadAbstracted articles with metadata, ranking, topics, and summary snippets.",
      inputSchema: mcpTopArticlesInputSchema,
      outputSchema: topArticlesResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: McpTopArticlesInput) => {
      try {
        const payload = await handleListTopArticles(input, context);
        return successToolResult(
          `Returned ${payload.articles.length} top ReadAbstracted articles.`,
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
        "Open one article using a single article reference. The server resolves ReadAbstracted IDs, paper URLs, and arXiv identifiers.",
      inputSchema: mcpOpenArticleInputSchema,
      outputSchema: articleResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: McpOpenArticleInput) => {
      try {
        const payload = await handleOpenArticle(input, context);
        return successToolResult(`Opened ${payload.article.title}.`, payload);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "get_article",
    {
      title: "Open a ReadAbstracted article",
      description:
        "Returns one normalized ReadAbstracted article with safe-summary content, metadata, tags, citation metadata, and canonical links.",
      inputSchema: mcpGetArticleInputSchema,
      outputSchema: articleResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: McpGetArticleInput) => {
      try {
        const payload = await handleGetArticle(input, context);
        return successToolResult(`Opened ${payload.article.title}.`, payload);
      } catch (error) {
        return errorToolResult(error);
      }
    },
  );

  server.registerTool(
    "search_articles",
    {
      title: "Search ReadAbstracted articles",
      description:
        "Searches ReadAbstracted articles by query, topic, and date filters, returning structured matches with snippets and relevance scores.",
      inputSchema: mcpSearchArticlesInputSchema,
      outputSchema: searchArticlesResponseSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: McpSearchArticlesInput) => {
      try {
        const payload = await handleSearchArticles(input, context);
        return successToolResult(
          `Found ${payload.results.length} matching ReadAbstracted articles for "${payload.query}".`,
          payload,
        );
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
        "Builds a structured comparison across two to five ReadAbstracted articles without generating the final prose answer.",
      inputSchema: mcpCompareArticlesInputSchema,
      outputSchema: articleComparisonSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (input: McpCompareArticlesInput) => {
      try {
        const payload = await handleCompareArticles({
          article_refs: input.article_refs,
          question: input.question,
        }, context);
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
