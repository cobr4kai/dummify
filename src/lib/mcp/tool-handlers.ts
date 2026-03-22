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
  return handleGetArticle(
    {
      article_ref: parsed.article_ref,
      article_id: undefined,
      url: undefined,
      arxiv_id: undefined,
      verbosity: parsed.verbosity,
    },
    context,
  );
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
        normalizedRef: requestedRef,
        suggestions,
        supportedVerbosity: ["quick", "standard", "deep"],
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
      {
        status: 404,
        details: {
          missingRefs,
          supportedVerbosity: ["quick", "standard", "deep"],
        },
      },
    );
  }

  const articles = await getArticlesForComparison(parsed, context);
  if (articles.length !== requestedRefs.length) {
    throw new McpServiceError(
      "not_found",
      "One or more articles could not be loaded for comparison.",
      {
        status: 404,
        details: {
          requestedRefs,
          supportedVerbosity: ["quick", "standard", "deep"],
        },
      },
    );
  }

  const comparisonSummary = buildComparisonSummary(parsed.question, articles);
  return articleComparisonSchema.parse({
    question: parsed.question ?? null,
    verbosity: parsed.verbosity ?? "standard",
    focusTerms: buildFocusTerms(parsed.question, articles),
    recommended_winner: comparisonSummary.recommended_winner,
    best_for: comparisonSummary.best_for,
    why: comparisonSummary.why,
    main_tradeoff: comparisonSummary.main_tradeoff,
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
        sourceBasis: article.analysis.sourceBasis,
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

function buildComparisonSummary(question: string | undefined, articles: ArticleDetail[]) {
  const questionTerms = splitKeywords(question ?? "");
  const scored = articles.map((article) => {
    const topicFit = scoreQuestionFit(article, questionTerms);
    const score = (article.ranking?.totalScore ?? 0) + topicFit;
    return { article, score, topicFit };
  }).sort((left, right) => right.score - left.score);

  const winner = scored[0]?.article ?? null;
  const runnerUp = scored[1]?.article ?? null;

  return {
    recommended_winner: winner
      ? {
          articleId: winner.id,
          title: winner.title,
        }
      : null,
    best_for: scored.map(({ article, topicFit }) => ({
      articleId: article.id,
      title: article.title,
      reasons: buildBestForReasons(article, questionTerms, topicFit),
    })),
    why: winner
      ? buildWinnerWhy(winner, questionTerms)
      : null,
    main_tradeoff: winner && runnerUp
      ? buildMainTradeoff(winner, runnerUp)
      : null,
  };
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

function scoreQuestionFit(article: ArticleDetail, questionTerms: string[]) {
  if (questionTerms.length === 0) {
    return 0;
  }

  const haystack = normalize([
    article.title,
    article.topics.join(" "),
    article.tags.join(" "),
    article.summary.quickTake ?? "",
    article.summary.whyItMatters ?? "",
  ].join(" "));

  return questionTerms.reduce((total, term) => total + (haystack.includes(term) ? 6 : 0), 0);
}

function buildBestForReasons(
  article: ArticleDetail,
  questionTerms: string[],
  topicFit: number,
) {
  const reasons: string[] = [];

  if (topicFit > 0) {
    reasons.push("Strong overlap with the comparison question.");
  }
  if ((article.ranking?.totalScore ?? 0) >= 85) {
    reasons.push("Higher editorial importance.");
  }
  if (article.technicalBrief?.sourceBasis === "full-pdf") {
    reasons.push("Backed by a full-PDF technical brief.");
  }
  if (article.summary.whyItMatters) {
    reasons.push(truncateSentence(article.summary.whyItMatters));
  }

  return reasons.slice(0, 3);
}

function buildWinnerWhy(article: ArticleDetail, questionTerms: string[]) {
  const reasons = buildBestForReasons(article, questionTerms, scoreQuestionFit(article, questionTerms));
  return reasons.join(" ");
}

function buildMainTradeoff(winner: ArticleDetail, runnerUp: ArticleDetail) {
  const winnerSource = winner.technicalBrief?.sourceBasis === "full-pdf"
    ? "deeper evidence"
    : "lighter evidence";
  const runnerUpSource = runnerUp.technicalBrief?.sourceBasis === "full-pdf"
    ? "deeper evidence"
    : "lighter evidence";

  return `${winner.title} looks stronger on overall fit and ${winnerSource}, while ${runnerUp.title} remains a plausible alternative with ${runnerUpSource}.`;
}

function truncateSentence(value: string, maxLength = 120) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}
