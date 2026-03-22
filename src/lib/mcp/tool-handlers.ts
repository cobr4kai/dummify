import { z, ZodError } from "zod";
import {
  articleComparisonSchema,
  articleLookupInputSchema,
  browseArticlesInputSchema,
  browseArticlesResponseSchema,
  compareArticlesInputSchema,
  openArticleInputSchema,
  searchArticlesInputSchema,
  type ArticleDetail,
  type ArticleResponse,
  type BrowseArticlesResponse,
  type SearchArticlesResponse,
  topArticlesInputSchema,
  type TopArticlesResponse,
} from "@repo-types/content";
import {
  browseArticlesContent,
  getArticleContent,
  getArticlesForComparison,
  getTopArticlesContent,
  openArticleContent,
  resolveArticleReference,
  searchArticlesContent,
  suggestArticleRefs,
} from "@/lib/content/service";

export const mcpToolErrorSchema = z.object({
  error: z.object({
    type: z.enum(["invalid_request", "not_found", "internal_error"]),
    message: z.string(),
    status: z.number().int().nullable().optional(),
    details: z.unknown().optional(),
  }),
});

export class McpServiceError extends Error {
  code: z.infer<typeof mcpToolErrorSchema>["error"]["type"];
  status: number | null;
  details?: unknown;

  constructor(
    code: z.infer<typeof mcpToolErrorSchema>["error"]["type"],
    message: string,
    options?: { status?: number | null; details?: unknown },
  ) {
    super(message);
    this.name = "McpServiceError";
    this.code = code;
    this.status = options?.status ?? null;
    this.details = options?.details;
  }
}

export type McpRequestContext = {
  requestOrigin?: string;
};

export async function handleListTopArticles(
  input: unknown,
  context: McpRequestContext = {},
) {
  const parsed = topArticlesInputSchema.parse(input);
  return getTopArticlesContent(parsed, context);
}

export async function handleBrowseArticles(
  input: unknown,
  context: McpRequestContext = {},
) {
  const parsed = browseArticlesInputSchema.parse(input);
  return browseArticlesContent(parsed, context);
}

export async function handleOpenArticle(
  input: unknown,
  context: McpRequestContext = {},
) {
  const parsed = openArticleInputSchema.parse(input);
  const payload = await openArticleContent(parsed, context);
  if (!payload) {
    const suggestions = await suggestArticleRefs(parsed.article_ref, context);
    throw new McpServiceError("not_found", "Article not found.", {
      status: 404,
      details: {
        requestedRef: parsed.article_ref,
        suggestions,
      },
    });
  }

  return payload;
}

export async function handleGetArticle(
  input: unknown,
  context: McpRequestContext = {},
) {
  const parsed = articleLookupInputSchema.parse(input);
  const payload = await getArticleContent(parsed, context);
  if (!payload) {
    const requestedRef = parsed.article_ref ?? parsed.article_id ?? parsed.url ?? parsed.arxiv_id ?? null;
    const suggestions = requestedRef ? await suggestArticleRefs(requestedRef, context) : [];
    throw new McpServiceError("not_found", "Article not found.", {
      status: 404,
      details: {
        requestedRef,
        suggestions,
      },
    });
  }

  return payload;
}

export async function handleSearchArticles(
  input: unknown,
  context: McpRequestContext = {},
) {
  const parsed = searchArticlesInputSchema.parse(input);
  return searchArticlesContent(parsed, context);
}

export async function handleCompareArticles(
  input: unknown,
  context: McpRequestContext = {},
) {
  const parsed = compareArticlesInputSchema.parse(input);
  const requestedRefs = parsed.article_refs ?? parsed.article_ids ?? [];
  const resolutions = await Promise.all(requestedRefs.map((articleRef) => resolveArticleReference(articleRef)));
  const missingRefs = requestedRefs.filter((_, index) => !resolutions[index]?.paperId);
  if (missingRefs.length > 0) {
    throw new McpServiceError(
      "not_found",
      `One or more articles could not be found: ${missingRefs.join(", ")}.`,
      { status: 404, details: { missingRefs } },
    );
  }

  const articles = await getArticlesForComparison(parsed, context);
  if (articles.length !== requestedRefs.length) {
    throw new McpServiceError(
      "not_found",
      "One or more articles could not be loaded for comparison.",
      { status: 404, details: { requestedRefs } },
    );
  }

  return articleComparisonSchema.parse({
    question: parsed.question ?? null,
    focusTerms: buildFocusTerms(parsed.question, articles),
    articles,
    comparison: {
      commonTopics: intersectNormalized(articles.map((article) => article.topics)),
      commonTags: intersectNormalized(articles.map((article) => article.tags)),
      scoreRanking: [...articles]
        .sort(
          (left, right) =>
            (right.ranking?.totalScore ?? -Infinity) - (left.ranking?.totalScore ?? -Infinity),
        )
        .map((article) => ({
          articleId: article.id,
          title: article.title,
          totalScore: article.ranking?.totalScore ?? null,
        })),
      publicationOrder: [...articles]
        .sort(
          (left, right) =>
            new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime(),
        )
        .map((article) => ({
          articleId: article.id,
          title: article.title,
          publishedAt: article.publishedAt,
        })),
      sourceBasisByArticle: articles.map((article) => ({
        articleId: article.id,
        sourceBasis: article.technicalBrief?.sourceBasis ?? null,
        usedFallbackAbstract: article.technicalBrief?.usedFallbackAbstract ?? null,
      })),
    },
  });
}

export function successToolResult<
  T extends
    | BrowseArticlesResponse
    | TopArticlesResponse
    | ArticleResponse
    | SearchArticlesResponse
    | z.infer<typeof articleComparisonSchema>,
>(summary: string, payload: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: summary,
      },
    ],
    structuredContent: payload,
  };
}

export function errorToolResult(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const payload = mcpToolErrorSchema.parse({
      error: {
        type: "invalid_request",
        message: issue?.message ?? "The MCP request was invalid.",
        status: 400,
        details: error.issues,
      },
    });

    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: payload.error.message,
        },
      ],
      structuredContent: payload,
    };
  }

  if (error instanceof McpServiceError) {
    const payload = mcpToolErrorSchema.parse({
      error: {
        type: error.code,
        message: error.message,
        status: error.status ?? null,
        details: error.details,
      },
    });

    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: error.message,
        },
      ],
      structuredContent: payload,
    };
  }

  const payload = mcpToolErrorSchema.parse({
    error: {
      type: "internal_error",
      message: error instanceof Error ? error.message : "Unknown MCP server error.",
      status: 500,
    },
  });

  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: payload.error.message,
      },
    ],
    structuredContent: payload,
  };
}

function buildFocusTerms(question: string | undefined, articles: ArticleDetail[]) {
  const fromQuestion = splitKeywords(question ?? "").slice(0, 8);
  if (fromQuestion.length > 0) {
    return fromQuestion;
  }

  return uniqueStrings(articles.flatMap((article) => article.topics)).slice(0, 8);
}

function intersectNormalized(valueGroups: string[][]) {
  if (valueGroups.length === 0) {
    return [];
  }

  const normalizedGroups = valueGroups.map((group) =>
    uniqueStrings(group).map((value) => ({
      normalized: normalize(value),
      original: value,
    })),
  );

  const baseline = normalizedGroups[0] ?? [];
  return baseline
    .filter((candidate) =>
      normalizedGroups.every((group) =>
        group.some((value) => value.normalized === candidate.normalized),
      ),
    )
    .map((value) => value.original);
}

function splitKeywords(value: string) {
  return uniqueStrings(
    value
      .toLowerCase()
      .split(/[^a-z0-9.+-]+/)
      .filter(Boolean),
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
