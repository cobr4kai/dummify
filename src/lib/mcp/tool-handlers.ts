import { z, ZodError } from "zod";
import {
  compareArticlesResponseSchema,
  compareArticlesV2InputSchema,
  discoverArticlesInputSchema,
  discoverArticlesResponseSchema,
  openArticleInputSchema,
  openArticleResponseSchema,
  summarizeTopArticlesInputSchema,
  summarizeTopArticlesResponseSchema,
  type ArticleDetail,
  type ArticleLookupInput,
  type ArticleSummary,
  type CanonicalArticle,
  type CompareArticlesResponse,
  type CompareArticlesV2Input,
  type DiscoverArticlesInput,
  type DiscoverArticlesResponse,
  type OpenArticleInput,
  type OpenArticleResponse,
  type SummarizeTopArticlesInput,
  type SummarizeTopArticlesResponse,
} from "@repo-types/content";
import {
  discoverArticlesContent,
  getArticleContent,
  getTopArticlesContent,
} from "@/lib/content/service";
import { formatWeekLabel } from "@/lib/utils/dates";

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

type DetailLevel = "quick" | "standard" | "deep";

export async function handleSummarizeTopArticles(
  input: SummarizeTopArticlesInput,
  context: McpRequestContext = {},
) {
  const parsed = summarizeTopArticlesInputSchema.parse(input);
  const payload = await getTopArticlesContent(
    {
      week: parsed.week,
      limit: parsed.limit,
      topic: parsed.topic,
    },
    context,
  );
  const liveEdition = parsed.week
    ? await getTopArticlesContent({ limit: 1 }, context)
    : payload;

  const articles = payload.articles.map((article, index) => ({
    article: toCanonicalArticle(article, parsed.verbosity, { includeAbstract: false }),
    editionPosition: index + 1,
    editionReason: article.ranking?.rationale ?? article.summarySnippet ?? article.analysis.whyItMatters,
  }));

  return summarizeTopArticlesResponseSchema.parse({
    schemaVersion: "2",
    edition: {
      editionType: "readabstracted_weekly",
      weekStart: payload.weekStart,
      weekLabel: payload.weekStart ? formatWeekLabel(payload.weekStart) : null,
      isLive: payload.weekStart !== null && payload.weekStart === liveEdition.weekStart,
      summary: {
        editorialAngle: buildEditionEditorialAngle(payload.articles),
        whyThisWeek: buildEditionWhyThisWeek(payload.articles),
      },
    },
    articles,
  });
}

export async function handleDiscoverArticles(
  input: DiscoverArticlesInput,
  context: McpRequestContext = {},
) {
  const parsed = discoverArticlesInputSchema.parse(input);
  const payload = await discoverArticlesContent(parsed, context);

  return discoverArticlesResponseSchema.parse({
    schemaVersion: "2",
    mode: payload.mode,
    query: payload.query,
    topic: payload.topic,
    audience: payload.audience,
    sort: payload.sort,
    weekStart: payload.weekStart,
    startDate: payload.startDate,
    endDate: payload.endDate,
    limit: payload.limit,
    results: payload.results.map((result) => ({
      article: toCanonicalArticle(result.article, parsed.verbosity, { includeAbstract: false }),
      discovery: result.discovery,
    })),
  });
}

export async function handleOpenArticle(
  input: OpenArticleInput,
  context: McpRequestContext = {},
) {
  const parsed = openArticleInputSchema.parse(input);
  const resolved = await resolveArticleByRef(parsed.article_ref, context);

  if (!resolved) {
    throw new McpServiceError("not_found", "Article not found.", {
      status: 404,
      details: {
        requestedRef: parsed.article_ref,
        suggestions: buildArticleRefSuggestions(parsed.article_ref),
        supportedVerbosity: ["quick", "standard", "deep"],
      },
    });
  }

  return openArticleResponseSchema.parse({
    schemaVersion: "2",
    article: toCanonicalArticle(resolved.article, parsed.verbosity, { includeAbstract: true }),
  });
}

export async function handleCompareArticles(
  input: CompareArticlesV2Input,
  context: McpRequestContext = {},
) {
  const parsed = compareArticlesV2InputSchema.parse(input);
  const resolvedArticles = await Promise.all(
    parsed.article_refs.map(async (articleRef) => ({
      articleRef,
      resolved: await resolveArticleByRef(articleRef, context),
    })),
  );

  const missingRefs = resolvedArticles
    .filter((item) => !item.resolved)
    .map((item) => item.articleRef);

  if (missingRefs.length > 0) {
    throw new McpServiceError(
      "not_found",
      `One or more articles could not be found: ${missingRefs.join(", ")}.`,
      {
        status: 404,
        details: {
          missingRefs,
        },
      },
    );
  }

  const articles = resolvedArticles.map((item) => item.resolved!.article);
  const duplicateResolvedIds = findDuplicateResolvedIds(articles);
  if (duplicateResolvedIds.length > 0) {
    throw new McpServiceError(
      "invalid_request",
      "Two or more references resolved to the same ReadAbstracted article.",
      {
        status: 400,
        details: {
          duplicateResolvedIds,
          submittedRefs: parsed.article_refs,
        },
      },
    );
  }

  const canonicalArticles = articles.map((article) =>
    toCanonicalArticle(article, parsed.verbosity, { includeAbstract: true }),
  );
  const comparison = buildComparisonSummary(canonicalArticles, parsed.question ?? null);

  return compareArticlesResponseSchema.parse({
    schemaVersion: "2",
    question: parsed.question ?? null,
    articles: canonicalArticles,
    comparison,
  });
}

export function successToolResult<
  T extends
    | SummarizeTopArticlesResponse
    | DiscoverArticlesResponse
    | OpenArticleResponse
    | CompareArticlesResponse,
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

async function resolveArticleByRef(
  articleRef: string,
  context: McpRequestContext,
) {
  const trimmed = articleRef.trim();

  if (trimmed.startsWith("/papers/")) {
    return lookupArticle({ url: trimmed }, context);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const byUrl = await lookupArticle({ url: trimmed }, context);
    if (byUrl) {
      return byUrl;
    }

    return lookupArticle({ arxiv_id: trimmed }, context);
  }

  const direct = await lookupArticle({ article_id: trimmed }, context);
  if (direct) {
    return direct;
  }

  return lookupArticle({ arxiv_id: trimmed }, context);
}

async function lookupArticle(
  lookup: ArticleLookupInput,
  context: McpRequestContext,
) {
  const payload = await getArticleContent(lookup, context);
  if (!payload) {
    return null;
  }

  return {
    lookup,
    article: payload.article,
  };
}

function toCanonicalArticle(
  article: ArticleSummary | ArticleDetail,
  detailLevel: DetailLevel,
  options: { includeAbstract: boolean },
): CanonicalArticle {
  const rankingScore = article.ranking?.totalScore ?? null;
  const rankingLabel = rankingScore === null
    ? null
    : rankingScore >= 85
      ? "High editorial priority"
      : rankingScore >= 70
        ? "Editorially prioritized"
        : "Scored for editorial relevance";
  const provenance = buildProvenance(article);
  const brief = buildCanonicalBrief(article, detailLevel);
  const abstract = options.includeAbstract && "abstract" in article ? article.abstract : null;

  return {
    id: article.id,
    title: article.title,
    canonicalUrl: article.canonicalUrl,
    arxivId: article.arxivId,
    arxivUrl: article.arxivUrl,
    publishedAt: article.publishedAt,
    authors: article.authors,
    categories: article.categories,
    topics: article.topics,
    tags: article.tags,
    ranking: article.ranking
      ? {
          score: rankingScore,
          label: rankingLabel,
          whyRanked: article.ranking.rationale ?? null,
        }
      : null,
    analysis: {
      quickTake: article.subtitle ?? article.analysis.thesis ?? null,
      whyItMatters: article.analysis.whyItMatters ?? null,
      methodType: article.analysis.methodType ?? null,
      likelyAudience: article.analysis.likelyAudience,
      topicTags: article.analysis.topicTags,
      caveats: limitByDetail(article.analysis.caveats, detailLevel, {
        quick: 1,
        standard: 2,
        deep: 3,
      }),
      noveltyScore: article.analysis.noveltyScore ?? null,
      businessRelevanceScore: article.analysis.businessRelevanceScore ?? null,
    },
    provenance,
    content: {
      abstract,
    },
    brief,
  };
}

function buildProvenance(article: ArticleSummary | ArticleDetail): CanonicalArticle["provenance"] {
  const technicalBrief = "technicalBrief" in article ? article.technicalBrief : null;
  const sourceUrls = uniqueStrings(
    "sourceReferences" in article
      ? article.sourceReferences.map((reference) => reference.sourceUrl)
      : [article.canonicalUrl, article.arxivUrl, article.abstractUrl],
  );

  if (article.analysis.sourceBasis === "editorial") {
    return {
      groundingTier: "editorial",
      briefState: "editorial_brief",
      sourceUrls,
    };
  }

  if (article.analysis.sourceBasis === "pdf_backed") {
    return {
      groundingTier: "pdf",
      briefState: "pdf_brief",
      sourceUrls,
    };
  }

  if (technicalBrief && !technicalBrief.usedFallbackAbstract) {
    return {
      groundingTier: "pdf",
      briefState: "pdf_brief",
      sourceUrls,
    };
  }

  if (technicalBrief && technicalBrief.usedFallbackAbstract) {
    return {
      groundingTier: "abstract",
      briefState: "none",
      sourceUrls,
    };
  }

  return {
    groundingTier: "abstract",
    briefState: "none",
    sourceUrls,
  };
}

function buildCanonicalBrief(
  article: ArticleSummary | ArticleDetail,
  detailLevel: DetailLevel,
): CanonicalArticle["brief"] {
  if (!("technicalBrief" in article) || !article.technicalBrief) {
    return null;
  }

  if (article.technicalBrief.usedFallbackAbstract) {
    return null;
  }

  const highlights = uniqueStrings(
    [
      article.technicalBrief.oneLineVerdict,
      article.technicalBrief.whyItMatters,
      article.technicalBrief.whatToIgnore,
      ...article.technicalBrief.bullets.map((bullet) => bullet.text),
    ].filter(Boolean),
  );

  return {
    kind: article.analysis.sourceBasis === "editorial" ? "editorial" : "pdf_backed",
    highlights: limitByDetail(highlights, detailLevel, {
      quick: 2,
      standard: 3,
      deep: 6,
    }),
    evidence: limitByDetail(
      article.technicalBrief.evidence.map((item) => ({
        claim: item.claim,
        confidence: item.confidence,
      })),
      detailLevel,
      {
        quick: 1,
        standard: 2,
        deep: 6,
      },
    ),
  };
}

function buildEditionEditorialAngle(articles: ArticleSummary[]) {
  if (articles.length === 0) {
    return null;
  }

  const commonTopics = uniqueStrings(articles.flatMap((article) => article.topics)).slice(0, 3);
  if (commonTopics.length === 0) {
    return "This week’s edition collects the strongest ReadAbstracted picks now live on the site.";
  }

  return `This week’s edition leans toward ${commonTopics.join(", ")} across the current curated homepage set.`;
}

function buildEditionWhyThisWeek(articles: ArticleSummary[]) {
  if (articles.length === 0) {
    return null;
  }

  const strongest = articles[0];
  return strongest?.ranking?.rationale
    ?? strongest?.summarySnippet
    ?? strongest?.analysis.whyItMatters
    ?? null;
}

function buildComparisonSummary(
  articles: CanonicalArticle[],
  question: string | null,
): CompareArticlesResponse["comparison"] {
  const sortedByScore = [...articles].sort(
    (left, right) => (right.ranking?.score ?? -Infinity) - (left.ranking?.score ?? -Infinity),
  );
  const publicationOrder = [...articles].sort(
    (left, right) => new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime(),
  );
  const commonTopics = intersectNormalized(articles.map((article) => article.topics));
  const commonTags = intersectNormalized(articles.map((article) => article.tags));
  const winner = sortedByScore[0] ?? null;
  const runnerUp = sortedByScore[1] ?? null;
  const focusTerms = splitKeywords(question ?? "");
  const bestFor = winner?.analysis.likelyAudience[0] ?? null;
  const why = winner
    ? buildWinnerReason(winner, runnerUp, focusTerms)
    : null;

  return {
    recommendedWinner: winner?.id ?? null,
    bestFor,
    why,
    mainTradeoff: buildMainTradeoff(winner, runnerUp),
    commonTopics,
    commonTags,
    scoreRanking: sortedByScore.map((article) => ({
      articleId: article.id,
      title: article.title,
      totalScore: article.ranking?.score ?? null,
    })),
    publicationOrder: publicationOrder.map((article) => ({
      articleId: article.id,
      title: article.title,
      publishedAt: article.publishedAt,
    })),
    provenanceByArticle: articles.map((article) => ({
      articleId: article.id,
      groundingTier: article.provenance.groundingTier,
      briefState: article.provenance.briefState,
    })),
  };
}

function buildWinnerReason(
  winner: CanonicalArticle,
  runnerUp: CanonicalArticle | null,
  focusTerms: string[],
) {
  const reasons = [
    winner.analysis.whyItMatters,
    winner.ranking?.whyRanked,
    winner.analysis.quickTake,
  ].filter(Boolean);

  if (focusTerms.length > 0) {
    const overlap = winner.topics
      .concat(winner.tags)
      .find((value) => focusTerms.some((term) => normalize(value).includes(term)));

    if (overlap) {
      reasons.unshift(`Strongest overlap with the requested focus on ${overlap}.`);
    }
  }

  if (runnerUp && winner.provenance.groundingTier !== runnerUp.provenance.groundingTier) {
    reasons.push(
      winner.provenance.groundingTier === "editorial" || winner.provenance.groundingTier === "pdf"
        ? "It is supported by a richer brief/provenance tier."
        : "It is simpler but more directly aligned to the prompt.",
    );
  }

  return reasons[0] ?? null;
}

function buildMainTradeoff(
  winner: CanonicalArticle | null,
  runnerUp: CanonicalArticle | null,
) {
  if (!winner || !runnerUp) {
    return null;
  }

  if (winner.provenance.groundingTier !== runnerUp.provenance.groundingTier) {
    return `${winner.title} has stronger grounding (${winner.provenance.groundingTier}), while ${runnerUp.title} may still be useful if you value topic fit over evidence depth.`;
  }

  return `${winner.title} scores higher editorially, while ${runnerUp.title} offers an alternative emphasis in ${runnerUp.analysis.topicTags[0] ?? "a narrower area"}.`;
}

function buildArticleRefSuggestions(articleRef: string) {
  const trimmed = articleRef.trim();
  return [
    trimmed.startsWith("/papers/") || /^https?:\/\//i.test(trimmed)
      ? "Use a canonical ReadAbstracted paper URL or path."
      : "Use a ReadAbstracted paper ID, /papers/{id} path, or arXiv ID.",
    "Try discover_articles first if you only know the topic or rough title.",
  ];
}

function findDuplicateResolvedIds(articles: Array<Pick<CanonicalArticle, "id">>) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const article of articles) {
    if (seen.has(article.id)) {
      duplicates.add(article.id);
      continue;
    }

    seen.add(article.id);
  }

  return Array.from(duplicates);
}

function limitByDetail<T>(
  items: T[],
  detailLevel: DetailLevel,
  limits: Record<DetailLevel, number>,
) {
  return items.slice(0, limits[detailLevel]);
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
