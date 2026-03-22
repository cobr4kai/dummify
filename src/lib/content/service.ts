import { BriefMode, Prisma } from "@prisma/client";
import { z } from "zod";
import {
  articleAnalysisSchema,
  articleDetailSchema,
  articleLookupInputSchema,
  articleResponseSchema,
  articleSearchResultSchema,
  articleSummarySchema,
  articleTechnicalBriefSchema,
  briefBulletSchema,
  briefCitationSchema,
  briefEvidenceSchema,
  briefKeyStatSchema,
  browseArticlesResponseSchema,
  openArticleInputSchema,
  searchArticlesResponseSchema,
  topArticlesResponseSchema,
  type ArticleDetail,
  type ArticleLookupInput,
  type ArticleLocatorSuggestion,
  type ArticleResponse,
  type ArticleSummary,
  type BrowseArticlesInput,
  type CompareArticlesInput,
  type OpenArticleInput,
  type SearchArticlesInput,
  type SearchArticlesResponse,
  type TopArticlesInput,
  type Verbosity,
} from "@repo-types/content";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  buildDeterministicStructuredMetadata,
  getOpenAlexTopics,
  getStructuredMetadataPayload,
} from "@/lib/metadata/service";
import { paperToSourceRecord } from "@/lib/papers/record";
import { getWeeklyBrief } from "@/lib/search/service";
import { stripTechnicalBriefHeading } from "@/lib/technical/brief-text";
import { getWeekEnd, getWeekStart } from "@/lib/utils/dates";
import { parseJsonValue } from "@/lib/utils/json";
import {
  canonicalizeArxivId,
  normalizeSearchText,
  normalizeWhitespace,
  round,
  splitKeywords,
} from "@/lib/utils/strings";

const contentPaperInclude = Prisma.validator<Prisma.PaperInclude>()({
  scores: {
    where: {
      isCurrent: true,
      mode: BriefMode.GENAI,
    },
    take: 1,
  },
  technicalBriefs: {
    where: { isCurrent: true },
    orderBy: { updatedAt: "desc" },
    take: 1,
  },
  pdfCaches: {
    where: { isCurrent: true },
    orderBy: { updatedAt: "desc" },
    take: 1,
  },
  enrichments: {
    where: { isCurrent: true },
  },
  publishedItems: {
    take: 1,
  },
});

type PaperWithContent = Prisma.PaperGetPayload<{
  include: typeof contentPaperInclude;
}>;

type DiscoveryField = SearchArticlesResponse["results"][number]["matchedFields"][number];
type RankingMode = NonNullable<ArticleSummary["ranking"]>["mode"];
type RankingDimension = NonNullable<ArticleSummary["ranking"]>["dimensions"][number];
type SearchMatchResult = {
  relevanceScore: number;
  matchedFields: DiscoveryField[];
  snippet: string;
  matchReason: string | null;
  exactTitlePhraseMatch: boolean;
  exactMetadataMatch: boolean;
  titleTermHits: number;
  metadataTermHits: number;
  bodyTermHits: number;
};
type LookupResolution = {
  paperId: string | null;
  requestedRef: string | null;
  normalizedRef: string | null;
  resolvedBy: ArticleResponse["resolvedBy"];
};

const stringArraySchema = z.array(z.string());
const openAlexPayloadSchema = z.object({
  topics: z.array(z.string()).optional(),
});
const keyStatsSchema = z.array(briefKeyStatSchema);
const bulletsSchema = z.array(briefBulletSchema);
const evidenceSchema = z.array(briefEvidenceSchema);
const scoreBreakdownItemSchema = z.object({
  label: z.string(),
  rawScore: z.number().optional(),
  weightedScore: z.number().optional(),
  reason: z.string().nullable().optional(),
});
const scoreBreakdownSchema = z.record(z.string(), scoreBreakdownItemSchema);
const DEFAULT_VERBOSITY: Verbosity = "standard";
const SUPPORTED_VERBOSITY = ["quick", "standard", "deep"] as const;
const SUPPORTED_SORTS = ["relevance", "editorial", "recency"] as const;
const DOMAIN_ALIASES: Record<string, string[]> = {
  robotics: ["robotics", "robotic", "robot", "cs.ro"],
  robot: ["robotics", "robotic", "robot", "cs.ro"],
  agents: ["agent", "agents", "multi-agent"],
  agent: ["agent", "agents", "multi-agent"],
  vision: ["vision", "computer vision", "cs.cv"],
  inference: ["inference", "latency", "serving"],
  training: ["training", "fine-tuning", "finetuning"],
  rag: ["rag", "retrieval", "retrieval-augmented"],
  retrieval: ["retrieval", "rag"],
  biology: ["biology", "bio", "q-bio"],
  infra: ["infra", "systems", "platform"],
};

export async function browseArticlesContent(
  input: BrowseArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const feed = input.query ? "search" : (input.feed ?? "top");
  if (feed === "search" && input.query) {
    return browseSearchArticlesContent({
      ...input,
      feed,
    }, options);
  }

  return browseTopArticlesContent({
    ...input,
    feed: "top",
  }, options);
}

export async function getTopArticlesContent(
  input: TopArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const payload = await browseTopArticlesContent({
    feed: "top",
    query: undefined,
    topic: input.topic,
    audience: input.audience,
    sort: input.sort,
    week: input.week,
    start_date: undefined,
    end_date: undefined,
    has_extracted_pdf: input.has_extracted_pdf,
    limit: input.limit,
  }, options);

  return topArticlesResponseSchema.parse(payload);
}

export async function openArticleContent(
  input: OpenArticleInput,
  options: { requestOrigin?: string } = {},
) {
  const parsed = openArticleInputSchema.parse(input);
  return getArticleContent(
    {
      article_ref: parsed.article_ref,
      article_id: undefined,
      url: undefined,
      arxiv_id: undefined,
      verbosity: parsed.verbosity,
    },
    options,
  );
}

export async function getArticleContent(
  lookup: ArticleLookupInput,
  options: { requestOrigin?: string } = {},
) {
  const parsed = articleLookupInputSchema.parse(lookup);
  const resolution = await resolveLookup(parsed);
  if (!resolution.paperId) {
    return null;
  }

  const paper = await prisma.paper.findUnique({
    where: { id: resolution.paperId },
    include: contentPaperInclude,
  });

  if (!paper) {
    return null;
  }

  const verbosity = resolveVerbosity(parsed.verbosity);
  const article = applyVerbosityToArticleDetail(
    normalizeArticleDetail(paper, options),
    verbosity,
  );

  return articleResponseSchema.parse({
    requestedRef: resolution.requestedRef,
    normalizedRef: resolution.normalizedRef,
    resolvedBy: resolution.resolvedBy,
    verbosity,
    article,
  });
}

export async function searchArticlesContent(
  input: SearchArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const results = await performArticleSearch(input, options);
  const verbosity = resolveVerbosity(input.verbosity);

  return searchArticlesResponseSchema.parse({
    feed: "search",
    query: input.query,
    topic: input.topic ?? null,
    audience: input.audience ?? null,
    sort: resolveSearchSort(input.sort),
    verbosity,
    weekStart: input.week ? getWeekStart(input.week) : null,
    startDate: results.dateRange?.startDate ?? null,
    endDate: results.dateRange?.endDate ?? null,
    limit: input.limit,
    hasExtractedPdf: input.has_extracted_pdf ?? null,
    topicSuggestions: collectTopicSuggestions(results.filteredArticles),
    results: results.results.map((result) => applyVerbosityToSearchResult(result, verbosity)),
  });
}

export async function getArticlesForComparison(
  input: string[] | CompareArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const articleRefs = Array.isArray(input)
    ? input
    : (input.article_refs ?? input.article_ids ?? []);
  const verbosity = Array.isArray(input) ? DEFAULT_VERBOSITY : resolveVerbosity(input.verbosity);
  const resolvedIds = await Promise.all(articleRefs.map((articleRef) => resolveArticleReference(articleRef)));
  const paperIds = resolvedIds
    .map((resolution, index) =>
      resolution.paperId ??
        (Array.isArray(input) && typeof input[index] === "string" ? input[index] : null)
    )
    .filter((value): value is string => Boolean(value));

  const papers = await prisma.paper.findMany({
    where: { id: { in: paperIds } },
    include: contentPaperInclude,
  });

  return orderByIds(
    papers.map((paper) => applyVerbosityToArticleDetail(normalizeArticleDetail(paper, options), verbosity)),
    paperIds,
  );
}

export async function resolvePaperIdFromLookup(lookup: ArticleLookupInput) {
  const resolution = await resolveLookup(articleLookupInputSchema.parse(lookup));
  return resolution.paperId;
}

export async function resolveArticleReference(articleRef: string) {
  const requestedRef = normalizeWhitespace(articleRef);
  const normalizedRef = normalizeArticleReference(articleRef);
  if (!requestedRef) {
    return {
      paperId: null,
      requestedRef: null,
      normalizedRef: null,
      resolvedBy: null,
    } satisfies LookupResolution;
  }

  const directMatch = await prisma.paper.findUnique({
    where: { id: requestedRef },
    select: { id: true },
  });
  if (directMatch) {
    return {
      paperId: directMatch.id,
      requestedRef,
      normalizedRef,
      resolvedBy: "article_ref",
    } satisfies LookupResolution;
  }

  const paperPathId = extractPaperIdFromUrl(requestedRef);
  if (paperPathId) {
    return {
      paperId: paperPathId,
      requestedRef,
      normalizedRef,
      resolvedBy: requestedRef.startsWith("/papers/") ? "paper_path" : "canonical_url",
    } satisfies LookupResolution;
  }

  const normalizedArxiv = canonicalizeArxivId(requestedRef);
  const paper = await prisma.paper.findFirst({
    where: {
      OR: [
        { arxivId: normalizedArxiv.arxivId },
        { versionedId: normalizedArxiv.versionedId },
      ],
    },
    select: { id: true },
  });

  return {
    paperId: paper?.id ?? null,
    requestedRef,
    normalizedRef,
    resolvedBy: paper ? "arxiv_id" : null,
  } satisfies LookupResolution;
}

export async function suggestArticleRefs(
  articleRef: string,
  options: { requestOrigin?: string; limit?: number } = {},
) {
  const requestedRef = normalizeWhitespace(articleRef);
  if (!requestedRef) {
    return [];
  }

  const extractedId = extractPaperIdFromUrl(requestedRef);
  const normalizedArxiv = canonicalizeArxivId(requestedRef);
  const searchTerms = uniqueStrings([
    requestedRef,
    extractedId ?? "",
    normalizedArxiv.arxivId,
    normalizedArxiv.versionedId,
    ...splitKeywords(requestedRef),
  ]).slice(0, 6);

  const papers = await prisma.paper.findMany({
    where: {
      OR: [
        ...searchTerms.flatMap((term) => [
          { id: { contains: term } },
          { arxivId: { contains: term } },
          { versionedId: { contains: term } },
          { title: { contains: term } },
          { searchText: { contains: normalizeSearchText(term) } },
        ]),
      ],
    },
    include: contentPaperInclude,
    take: Math.max(options.limit ?? 5, 5),
    orderBy: [{ publishedAt: "desc" }],
  });

  return uniqueBy(
    papers.map((paper) => {
      const summary = normalizeArticleSummary(paper, options);
      const reason = resolveSuggestionReason({
        requestedRef,
        extractedId,
        normalizedArxivId: normalizedArxiv.arxivId,
        normalizedVersionedId: normalizedArxiv.versionedId,
        paper,
      });

      return {
        articleRef: summary.article.articleRef,
        title: summary.title,
        canonicalUrl: summary.canonicalUrl,
        arxivId: summary.arxivId,
        reason,
      } satisfies ArticleLocatorSuggestion;
    }),
    (suggestion) => suggestion.articleRef,
  ).slice(0, options.limit ?? 5);
}

export function matchesTopic(
  article: Pick<ArticleSummary, "topics" | "tags" | "categories">,
  topic?: string,
) {
  if (!topic) {
    return true;
  }

  const normalizedTopic = normalizeSearchText(topic);
  return [...article.topics, ...article.tags, ...article.categories].some((value) =>
    normalizeSearchText(value).includes(normalizedTopic)
  );
}

export function scoreArticleMatch(article: ArticleDetail, query: string): SearchMatchResult {
  const exactPhrase = normalizeSearchText(query);
  const searchTerms = uniqueStrings(splitKeywords(query));
  const expandedTerms = expandSearchTerms(searchTerms);
  const matches = new Set<DiscoveryField>();
  let relevanceScore = 0;

  const exactTitlePhraseMatch = Boolean(
    exactPhrase && normalizeSearchText(article.title).includes(exactPhrase),
  );
  const metadataHaystack = [
    article.categories.join(" "),
    article.tags.join(" "),
    article.topics.join(" "),
    article.analysis.topicTags.join(" "),
    article.analysis.methodType,
    article.analysis.likelyAudience.join(" "),
    article.arxivId,
  ].join(" ");
  const exactMetadataMatch = Boolean(
    exactPhrase && normalizeSearchText(metadataHaystack).includes(exactPhrase),
  );

  const titleTermHits = countTermHits(article.title, expandedTerms);
  const subtitleTermHits = countTermHits(article.summary.quickTake ?? "", expandedTerms);
  const metadataTermHits =
    countTermHits(article.categories.join(" "), expandedTerms) +
    countTermHits(article.tags.join(" "), expandedTerms) +
    countTermHits(article.topics.join(" "), expandedTerms);
  const analysisTermHits = countTermHits(buildAnalysisSearchText(article), expandedTerms);
  const bodyTermHits =
    countTermHits(article.abstract, expandedTerms) +
    countTermHits(article.bestAvailableText, expandedTerms);

  relevanceScore += scoreTextField(article.title, expandedTerms, "title", matches, 8);
  relevanceScore += scoreTextField(article.summary.quickTake ?? "", expandedTerms, "subtitle", matches, 4);
  relevanceScore += scoreTextField(article.abstract, expandedTerms, "abstract", matches, 2);
  relevanceScore += scoreTextField(article.bestAvailableText, expandedTerms, "technicalBrief", matches, 1.5);
  relevanceScore += scoreTextField(article.topics.join(" "), expandedTerms, "topics", matches, 6);
  relevanceScore += scoreTextField(article.tags.join(" "), expandedTerms, "tags", matches, 5);
  relevanceScore += scoreTextField(buildAnalysisSearchText(article), expandedTerms, "analysis", matches, 4);

  if (exactTitlePhraseMatch) {
    relevanceScore += 24;
  }
  if (exactMetadataMatch) {
    relevanceScore += 16;
  }
  if (exactPhrase && normalizeSearchText(buildAnalysisSearchText(article)).includes(exactPhrase)) {
    relevanceScore += 10;
  }
  relevanceScore += titleTermHits * 3;
  relevanceScore += metadataTermHits * 2.5;
  relevanceScore += analysisTermHits * 2;
  relevanceScore += subtitleTermHits * 1.5;
  relevanceScore += bodyTermHits;

  return {
    relevanceScore,
    matchedFields: Array.from(matches),
    snippet: buildSearchSnippet(article, expandedTerms),
    matchReason: buildMatchReason(Array.from(matches), query),
    exactTitlePhraseMatch,
    exactMetadataMatch,
    titleTermHits,
    metadataTermHits,
    bodyTermHits,
  };
}

async function browseTopArticlesContent(
  input: BrowseArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const requestedWeekStart = input.week ? getWeekStart(input.week) : null;
  const normalizedSort = resolveTopSort(input.sort);
  const weeklyBrief = await getWeeklyBrief({
    weekStart: requestedWeekStart,
    category: "all",
    sort: "score",
  });

  const paperIds = weeklyBrief.papers.map((paper) => paper.id);
  if (paperIds.length === 0) {
    return browseArticlesResponseSchema.parse({
      feed: "top",
      query: null,
      topic: input.topic ?? null,
      audience: input.audience ?? null,
      sort: normalizedSort,
      weekStart: weeklyBrief.weekStart,
      startDate: null,
      endDate: null,
      limit: input.limit,
      hasExtractedPdf: input.has_extracted_pdf ?? null,
      topicSuggestions: [],
      articles: [],
    });
  }

  const papers = await prisma.paper.findMany({
    where: { id: { in: paperIds } },
    include: contentPaperInclude,
  });

  let articles = orderByIds(
    papers.map((paper) => normalizeArticleSummary(paper, {
      ...options,
      audience: input.audience,
    })),
    paperIds,
  )
    .filter((article) => matchesTopic(article, input.topic))
    .filter((article) => matchesPdfAvailability(article, input.has_extracted_pdf));

  articles = sortTopArticles(articles, normalizedSort, input.audience).map((article) =>
    articleSummarySchema.parse({
      ...article,
      discovery: {
        matchedOn: [],
        matchSnippet: null,
        matchReason: null,
        sortReason: buildSortReason({
          feed: "top",
          sort: normalizedSort,
          audience: input.audience,
        }),
      },
    })
  );

  const limitedArticles = articles.slice(0, input.limit);

  return browseArticlesResponseSchema.parse({
    feed: "top",
    query: null,
    topic: input.topic ?? null,
    audience: input.audience ?? null,
    sort: normalizedSort,
    weekStart: weeklyBrief.weekStart,
    startDate: null,
    endDate: null,
    limit: input.limit,
    hasExtractedPdf: input.has_extracted_pdf ?? null,
    topicSuggestions: collectTopicSuggestions(articles),
    articles: limitedArticles,
  });
}

async function browseSearchArticlesContent(
  input: BrowseArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const query = input.query ?? "";
  const payload = await searchArticlesContent({
    query,
    topic: input.topic,
    audience: input.audience,
    sort: input.sort,
    week: input.week,
    start_date: input.start_date,
    end_date: input.end_date,
    has_extracted_pdf: input.has_extracted_pdf,
    limit: input.limit,
  }, options);

  return browseArticlesResponseSchema.parse({
    feed: "search",
    query: payload.query,
    topic: payload.topic,
    audience: payload.audience,
    sort: payload.sort,
    weekStart: payload.weekStart,
    startDate: payload.startDate,
    endDate: payload.endDate,
    limit: payload.limit,
    hasExtractedPdf: payload.hasExtractedPdf,
    topicSuggestions: payload.topicSuggestions,
    articles: payload.results.map((result) => articleSummarySchema.parse(result)),
  });
}

async function performArticleSearch(
  input: SearchArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const normalizedQuery = normalizeSearchText(input.query);
  const searchTerms = expandSearchTerms(
    uniqueStrings([normalizedQuery, ...splitKeywords(input.query)]).slice(0, 8),
  );
  const dateRange = resolveDateRange(input);
  const normalizedSort = resolveSearchSort(input.sort);

  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      ...(dateRange
        ? {
            announcementDay: {
              ...(dateRange.startDate ? { gte: dateRange.startDate } : {}),
              ...(dateRange.endDate ? { lte: dateRange.endDate } : {}),
            },
          }
        : {}),
      OR: buildSearchClauses(searchTerms),
    },
    include: contentPaperInclude,
    orderBy: [{ publishedAt: "desc" }],
    take: 250,
  });

  const detailedArticles = papers
    .map((paper) => normalizeArticleDetail(paper, {
      ...options,
      audience: input.audience,
    }))
    .filter((article) => matchesTopic(article, input.topic))
    .filter((article) => matchesPdfAvailability(article, input.has_extracted_pdf));

  const results = detailedArticles
    .map((article) => {
      const match = scoreArticleMatch(article, input.query);
      if (match.relevanceScore <= 0) {
        return null;
      }

      const summarized = articleSummarySchema.parse({
        ...article,
        summary: {
          ...article.summary,
          whyMatched: match.snippet,
        },
        discovery: {
          matchedOn: match.matchedFields,
          matchSnippet: match.snippet,
          matchReason: match.matchReason,
          sortReason: buildSortReason({
            feed: "search",
            sort: normalizedSort,
            audience: input.audience,
          }),
        },
      });

      return articleSearchResultSchema.parse({
        ...summarized,
        relevanceScore: round(match.relevanceScore, 1),
        matchedFields: match.matchedFields,
        snippet: match.snippet,
      });
    })
    .filter((result): result is SearchArticlesResponse["results"][number] => result !== null);

  const sortedResults = sortSearchResults(results, normalizedSort, input.audience).slice(0, input.limit);

  return {
    dateRange,
    filteredArticles: sortedResults.map((result) => articleSummarySchema.parse(result)),
    results: sortedResults,
  };
}

function normalizeArticleSummary(
  paper: PaperWithContent,
  options: { requestOrigin?: string; audience?: BrowseArticlesInput["audience"] },
): ArticleSummary {
  return articleSummarySchema.parse(buildArticleBase(paper, options));
}

function normalizeArticleDetail(
  paper: PaperWithContent,
  options: { requestOrigin?: string; audience?: BrowseArticlesInput["audience"] },
): ArticleDetail {
  const base = buildArticleBase(paper, options);
  const technicalBrief = buildTechnicalBrief(paper);
  const bestAvailableText = buildBestAvailableText(
    paper.abstract,
    base.analysis,
    technicalBrief,
  );

  return articleDetailSchema.parse({
    ...base,
    abstract: paper.abstract,
    bestAvailableText,
    technicalBrief,
    sourceReferences: buildSourceReferences(paper, base.canonicalUrl, technicalBrief),
  });
}

function resolveVerbosity(verbosity?: Verbosity) {
  return verbosity ?? DEFAULT_VERBOSITY;
}

function applyVerbosityToArticleDetail(article: ArticleDetail, verbosity: Verbosity): ArticleDetail {
  if (verbosity === "deep") {
    return article;
  }

  const sourceReferenceLimit = verbosity === "quick" ? 3 : 6;
  const dimensionLimit = verbosity === "quick" ? 2 : 4;
  const bulletLimit = verbosity === "quick" ? 1 : 3;
  const evidenceLimit = verbosity === "quick" ? 1 : 3;
  const keyStatLimit = verbosity === "quick" ? 1 : 3;
  const citationLimit = verbosity === "quick" ? 1 : 2;

  const technicalBrief = article.technicalBrief
    ? {
        ...article.technicalBrief,
        confidenceNotes: article.technicalBrief.confidenceNotes.slice(
          0,
          verbosity === "quick" ? 1 : 2,
        ),
        keyStats: article.technicalBrief.keyStats.slice(0, keyStatLimit).map((item) => ({
          ...item,
          citations: item.citations.slice(0, citationLimit),
        })),
        bullets: article.technicalBrief.bullets.slice(0, bulletLimit).map((item) => ({
          ...item,
          citations: item.citations.slice(0, citationLimit),
        })),
        evidence: article.technicalBrief.evidence.slice(0, evidenceLimit).map((item) => ({
          ...item,
          citations: item.citations.slice(0, citationLimit),
        })),
      }
    : null;

  return articleDetailSchema.parse({
    ...article,
    ranking: article.ranking
      ? {
          ...article.ranking,
          dimensions: article.ranking.dimensions.slice(0, dimensionLimit),
        }
      : null,
    summarySnippet: article.summarySnippet
      ? truncateText(article.summarySnippet, verbosity === "quick" ? 140 : 220)
      : null,
    summary: {
      ...article.summary,
      preview: article.summary.preview
        ? truncateText(article.summary.preview, verbosity === "quick" ? 140 : 220)
        : null,
      abstract: article.summary.abstract
        ? truncateText(article.summary.abstract, verbosity === "quick" ? 220 : 600)
        : null,
    },
    bestAvailableText: truncateText(article.bestAvailableText, verbosity === "quick" ? 280 : 1400),
    technicalBrief,
    sourceReferences: article.sourceReferences.slice(0, sourceReferenceLimit),
  });
}

function applyVerbosityToSearchResult(
  result: SearchArticlesResponse["results"][number],
  verbosity: Verbosity,
) {
  const snippetLength = verbosity === "quick" ? 160 : verbosity === "standard" ? 240 : 280;
  return articleSearchResultSchema.parse({
    ...result,
    summarySnippet: result.summarySnippet ? truncateText(result.summarySnippet, snippetLength) : null,
    snippet: truncateText(result.snippet, snippetLength),
    ranking: result.ranking
      ? {
          ...result.ranking,
          dimensions: result.ranking.dimensions.slice(0, verbosity === "quick" ? 2 : 4),
        }
      : null,
    summary: {
      ...result.summary,
      preview: result.summary.preview ? truncateText(result.summary.preview, snippetLength) : null,
      abstract: result.summary.abstract
        ? truncateText(result.summary.abstract, verbosity === "quick" ? 220 : 480)
        : null,
      whyMatched: result.summary.whyMatched
        ? truncateText(result.summary.whyMatched, snippetLength)
        : null,
    },
  });
}

function buildArticleBase(
  paper: PaperWithContent,
  options: { requestOrigin?: string; audience?: BrowseArticlesInput["audience"] },
) {
  const siteBaseUrl = resolveSiteBaseUrl(options.requestOrigin);
  const score = paper.scores[0] ?? null;
  const technicalBrief = buildTechnicalBrief(paper);
  const availability = buildPdfAvailability(paper);
  const analysis = buildArticleAnalysis(paper);
  const categories = parseJsonValue(paper.categoriesJson, stringArraySchema, []);
  const sourceFeedCategories = parseJsonValue(paper.sourceFeedCategoriesJson, stringArraySchema, []);
  const focusTags = technicalBrief?.focusTags ?? [];
  const topics = uniqueStrings([...analysis.topicTags, ...focusTags, ...categories]);
  const tags = uniqueStrings([
    ...categories,
    ...sourceFeedCategories,
    ...focusTags,
    ...analysis.topicTags,
    analysis.methodType,
    ...analysis.likelyAudience,
  ]);
  const quickTake = technicalBrief?.oneLineVerdict
    ? stripTechnicalBriefHeading(technicalBrief.oneLineVerdict)
    : analysis.thesis;
  const whyItMatters = technicalBrief?.whyItMatters ?? analysis.whyItMatters;
  const whyRanked = score?.rationale ?? null;
  const preview = truncateText(whyItMatters ?? quickTake ?? paper.abstract, 220);

  return {
    id: paper.id,
    arxivId: paper.arxivId,
    title: paper.title,
    subtitle: quickTake || null,
    canonicalUrl: buildAbsoluteUrl(siteBaseUrl, `/papers/${paper.id}`),
    arxivUrl: paper.abstractUrl,
    abstractUrl: paper.abstractUrl,
    publishedAt: paper.publishedAt.toISOString(),
    announcementDay: paper.announcementDay,
    weekStart: getWeekStart(paper.announcementDay),
    authors: parseJsonValue(paper.authorsJson, stringArraySchema, []),
    categories,
    topics,
    tags,
    analysis,
    ranking: buildRanking(score, options.audience),
    summarySnippet: preview || null,
    pdfAvailability: availability,
    article: {
      id: paper.id,
      articleRef: paper.id,
      arxivId: paper.arxivId,
      title: paper.title,
      canonicalUrl: buildAbsoluteUrl(siteBaseUrl, `/papers/${paper.id}`),
      arxivUrl: paper.abstractUrl,
      abstractUrl: paper.abstractUrl,
      publishedAt: paper.publishedAt.toISOString(),
      announcementDay: paper.announcementDay,
      weekStart: getWeekStart(paper.announcementDay),
      authors: parseJsonValue(paper.authorsJson, stringArraySchema, []),
      categories,
      topics,
      tags,
    },
    summary: {
      preview: preview || null,
      quickTake: quickTake || null,
      whyItMatters,
      whyRanked,
      whyMatched: null,
      abstract: paper.abstract,
    },
    availability,
    discovery: null,
  };
}

function buildArticleAnalysis(paper: PaperWithContent) {
  const enrichments = paper.enrichments.map((enrichment) => ({
    provider: enrichment.provider,
    payload:
      typeof enrichment.payload === "object" && enrichment.payload
        ? (enrichment.payload as Record<string, unknown>)
        : {},
  }));
  const structuredMetadata = getStructuredMetadataPayload(enrichments);
  if (structuredMetadata) {
    return articleAnalysisSchema.parse({
      thesis: structuredMetadata.thesis,
      whyItMatters: structuredMetadata.whyItMatters,
      topicTags: structuredMetadata.topicTags,
      methodType: structuredMetadata.methodType,
      evidenceStrength: structuredMetadata.evidenceStrength,
      likelyAudience: structuredMetadata.likelyAudience,
      caveats: structuredMetadata.caveats,
      noveltyScore: structuredMetadata.noveltyScore,
      businessRelevanceScore: structuredMetadata.businessRelevanceScore,
      sourceBasis: structuredMetadata.sourceBasis,
    });
  }

  const deterministic = buildDeterministicStructuredMetadata(paperToSourceRecord(paper), {
    isEditorial: paper.publishedItems.length > 0 && hasPdfBackedBrief(paper),
    hasPdfBackedBrief: hasPdfBackedBrief(paper),
    openAlexTopics: getOpenAlexTopics(enrichments),
  });

  return articleAnalysisSchema.parse({
    thesis: deterministic.thesis,
    whyItMatters: deterministic.whyItMatters,
    topicTags: deterministic.topicTags,
    methodType: deterministic.methodType,
    evidenceStrength: deterministic.evidenceStrength,
    likelyAudience: deterministic.likelyAudience,
    caveats: deterministic.caveats,
    noveltyScore: deterministic.noveltyScore,
    businessRelevanceScore: deterministic.businessRelevanceScore,
    sourceBasis: deterministic.sourceBasis,
  });
}

function buildRanking(
  score: PaperWithContent["scores"][number] | null,
  audience?: BrowseArticlesInput["audience"],
) {
  if (!score) {
    return null;
  }

  const breakdown = parseJsonValue(score.breakdown, scoreBreakdownSchema, {});
  const dimensions: RankingDimension[] = Object.entries(breakdown)
    .map(([name, item]) => ({
      name,
      label: item.label,
      score: round(item.weightedScore ?? item.rawScore ?? 0, 1),
      reason: item.reason ?? null,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  return {
    mode: "editorial" as RankingMode,
    label: buildRankingLabel(audience, dimensions),
    score: round(score.totalScore, 1),
    dimensions,
    whyRanked: score.rationale ?? null,
    totalScore: round(score.totalScore, 1),
    rationale: score.rationale ?? null,
  };
}

function buildTechnicalBrief(paper: PaperWithContent) {
  const technicalBrief = paper.technicalBriefs[0];
  if (!technicalBrief) {
    return null;
  }

  return articleTechnicalBriefSchema.parse({
    oneLineVerdict: stripTechnicalBriefHeading(technicalBrief.oneLineVerdict),
    whyItMatters: technicalBrief.whyItMatters,
    whatToIgnore: technicalBrief.whatToIgnore,
    focusTags: parseJsonValue(technicalBrief.focusTagsJson, stringArraySchema, []),
    confidenceNotes: parseJsonValue(technicalBrief.confidenceNotesJson, stringArraySchema, []),
    keyStats: hydrateCitations(
      parseJsonValue(technicalBrief.keyStatsJson, keyStatsSchema, []),
      paper,
    ),
    bullets: hydrateCitations(
      parseJsonValue(technicalBrief.bulletsJson, bulletsSchema, []),
      paper,
    ),
    evidence: hydrateCitations(
      parseJsonValue(technicalBrief.evidenceJson, evidenceSchema, []),
      paper,
    ),
    sourceBasis: technicalBrief.usedFallbackAbstract ? "abstract-fallback" : "full-pdf",
    usedFallbackAbstract: technicalBrief.usedFallbackAbstract,
  });
}

function buildPdfAvailability(paper: PaperWithContent) {
  const pdfCache = paper.pdfCaches[0];
  if (!pdfCache) {
    return null;
  }

  const hasExtractedPdf =
    pdfCache.extractionStatus === "EXTRACTED" && (pdfCache.pageCount ?? 0) > 0;

  return {
    hasPdfUrl: Boolean(paper.pdfUrl),
    hasExtractedText: hasExtractedPdf,
    hasExtractedPdf,
    extractionStatus: pdfCache.extractionStatus,
    usedFallbackAbstract: pdfCache.usedFallbackAbstract,
    pageCount: pdfCache.pageCount ?? null,
    fileSizeBytes: pdfCache.fileSizeBytes ?? null,
  };
}

function hasPdfBackedBrief(
  paper: Pick<PaperWithContent, "technicalBriefs">,
) {
  return paper.technicalBriefs.some((brief) => !brief.usedFallbackAbstract);
}

function buildBestAvailableText(
  abstract: string,
  analysis: ReturnType<typeof buildArticleAnalysis>,
  technicalBrief: ReturnType<typeof buildTechnicalBrief>,
) {
  const parts = [
    abstract,
    analysis.thesis,
    analysis.whyItMatters,
    analysis.methodType,
    analysis.topicTags.join(" "),
    analysis.likelyAudience.join(" "),
    analysis.caveats.join(" "),
    technicalBrief?.oneLineVerdict,
    technicalBrief?.whyItMatters,
    technicalBrief?.whatToIgnore,
    ...(technicalBrief?.keyStats.map((item) => `${item.label}: ${item.value}. ${item.context}`) ?? []),
    ...(technicalBrief?.bullets.map((bullet) => bullet.text) ?? []),
  ];

  return normalizeWhitespace(parts.filter(Boolean).join(" "));
}

function buildAnalysisSearchText(article: Pick<ArticleDetail, "analysis">) {
  return normalizeWhitespace(
    [
      article.analysis.thesis,
      article.analysis.whyItMatters,
      article.analysis.topicTags.join(" "),
      article.analysis.methodType,
      article.analysis.likelyAudience.join(" "),
      article.analysis.caveats.join(" "),
      article.analysis.sourceBasis.replace(/_/g, " "),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function buildSourceReferences(
  paper: PaperWithContent,
  canonicalUrl: string,
  technicalBrief: ReturnType<typeof buildTechnicalBrief>,
) {
  const baseReferences = [
    {
      label: "ReadAbstracted article",
      kind: "readabstracted" as const,
      sourceUrl: canonicalUrl,
      page: null,
      section: null,
    },
    {
      label: "arXiv abstract",
      kind: "arxiv-abstract" as const,
      sourceUrl: paper.abstractUrl,
      page: null,
      section: null,
    },
    ...(paper.pdfUrl
      ? [{
          label: "arXiv PDF",
          kind: "arxiv-pdf" as const,
          sourceUrl: paper.pdfUrl,
          page: null,
          section: null,
        }]
      : []),
  ];

  const citationReferences = [
    ...(technicalBrief?.keyStats ?? []).flatMap((item) =>
      item.citations.map((citation) => ({
        label: item.label,
        kind: "citation" as const,
        sourceUrl: citation.sourceUrl ?? paper.pdfUrl ?? paper.abstractUrl,
        page: citation.page,
        section: citation.section ?? null,
      }))
    ),
    ...(technicalBrief?.bullets ?? []).flatMap((bullet) =>
      bullet.citations.map((citation) => ({
        label: bullet.label,
        kind: "citation" as const,
        sourceUrl: citation.sourceUrl ?? paper.pdfUrl ?? paper.abstractUrl,
        page: citation.page,
        section: citation.section ?? null,
      }))
    ),
    ...(technicalBrief?.evidence ?? []).flatMap((item) =>
      item.citations.map((citation) => ({
        label: item.claim,
        kind: "citation" as const,
        sourceUrl: citation.sourceUrl ?? paper.pdfUrl ?? paper.abstractUrl,
        page: citation.page,
        section: citation.section ?? null,
      }))
    ),
  ];

  return uniqueBy([...baseReferences, ...citationReferences], (reference) =>
    `${reference.kind}:${reference.sourceUrl}:${reference.page ?? "none"}:${reference.section ?? "none"}:${reference.label}`
  );
}

function hydrateCitations<T extends { citations: Array<z.infer<typeof briefCitationSchema>> }>(
  items: T[],
  paper: PaperWithContent,
) {
  return items.map((item) => ({
    ...item,
    citations: item.citations.map((citation) => ({
      page: citation.page,
      section: citation.section ?? null,
      sourceUrl: citation.sourceUrl ?? paper.pdfUrl ?? paper.abstractUrl,
    })),
  }));
}

async function resolveLookup(lookup: ArticleLookupInput): Promise<LookupResolution> {
  if (lookup.article_ref) {
    return resolveArticleReference(lookup.article_ref);
  }

  if (lookup.article_id) {
    return {
      paperId: lookup.article_id.trim(),
      requestedRef: lookup.article_id.trim(),
      normalizedRef: normalizeArticleReference(lookup.article_id),
      resolvedBy: "article_id",
    };
  }

  if (lookup.url) {
    const paperId = extractPaperIdFromUrl(lookup.url);
    return {
      paperId,
      requestedRef: lookup.url,
      normalizedRef: normalizeArticleReference(lookup.url),
      resolvedBy: lookup.url.startsWith("/papers/") ? "paper_path" : "canonical_url",
    };
  }

  if (lookup.arxiv_id) {
    const normalized = canonicalizeArxivId(lookup.arxiv_id);
    const paper = await prisma.paper.findFirst({
      where: {
        OR: [
          { arxivId: normalized.arxivId },
          { versionedId: normalized.versionedId },
        ],
      },
      select: { id: true },
    });

    return {
      paperId: paper?.id ?? null,
      requestedRef: lookup.arxiv_id,
      normalizedRef: normalizeArticleReference(lookup.arxiv_id),
      resolvedBy: paper ? "arxiv_id" : null,
    };
  }

  return {
    paperId: null,
    requestedRef: null,
    normalizedRef: null,
    resolvedBy: null,
  };
}

function buildSearchClauses(searchTerms: string[]) {
  if (searchTerms.length === 0) {
    return [{ searchText: { contains: "" } }];
  }

  return searchTerms.flatMap((term) => [
    { searchText: { contains: term } },
    { title: { contains: term } },
    { abstract: { contains: term } },
    { categoryText: { contains: term } },
    { primaryCategory: { contains: term } },
    { arxivId: { contains: term } },
    { versionedId: { contains: term } },
    {
      technicalBriefs: {
        some: {
          isCurrent: true,
          OR: [
            { oneLineVerdict: { contains: term } },
            { whyItMatters: { contains: term } },
            { whatToIgnore: { contains: term } },
          ],
        },
      },
    },
  ]);
}

function resolveDateRange(input: Pick<SearchArticlesInput, "week" | "start_date" | "end_date">) {
  const weekStart = input.week ? getWeekStart(input.week) : null;
  const weekEnd = weekStart ? getWeekEnd(weekStart) : null;
  const startDate = maxDateString(weekStart, input.start_date ?? null);
  const endDate = minDateString(weekEnd, input.end_date ?? null);

  if (!startDate && !endDate) {
    return null;
  }

  return { startDate, endDate };
}

function resolveTopSort(sort?: BrowseArticlesInput["sort"]) {
  return sort === "recency" ? "recency" : "editorial";
}

function resolveSearchSort(sort?: SearchArticlesInput["sort"]) {
  return sort ?? "relevance";
}

function sortTopArticles(
  articles: ArticleSummary[],
  sort: ReturnType<typeof resolveTopSort>,
  audience?: BrowseArticlesInput["audience"],
) {
  if (sort === "recency") {
    return [...articles].sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
    );
  }

  if (!audience) {
    return [...articles];
  }

  return [...articles].sort((left, right) => {
    const audienceDelta = getAudienceRankingScore(right.ranking, audience) -
      getAudienceRankingScore(left.ranking, audience);
    if (audienceDelta !== 0) {
      return audienceDelta;
    }

    return (right.ranking?.totalScore ?? -Infinity) - (left.ranking?.totalScore ?? -Infinity);
  });
}

function sortSearchResults(
  results: SearchArticlesResponse["results"],
  sort: ReturnType<typeof resolveSearchSort>,
  audience?: BrowseArticlesInput["audience"],
) {
  return [...results].sort((left, right) => {
    if (sort === "recency") {
      const recencyDelta =
        new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
      if (recencyDelta !== 0) {
        return recencyDelta;
      }
    }

    if (sort === "editorial") {
      const editorialDelta = (right.ranking?.totalScore ?? -Infinity) -
        (left.ranking?.totalScore ?? -Infinity);
      if (editorialDelta !== 0) {
        return editorialDelta;
      }
    }

    if (sort !== "recency") {
      const relevanceDelta = right.relevanceScore - left.relevanceScore;
      if (relevanceDelta !== 0) {
        return relevanceDelta;
      }
    }

    const audienceDelta = getAudienceRankingScore(right.ranking, audience) -
      getAudienceRankingScore(left.ranking, audience);
    if (audienceDelta !== 0) {
      return audienceDelta;
    }

    const editorialDelta = (right.ranking?.totalScore ?? -Infinity) -
      (left.ranking?.totalScore ?? -Infinity);
    if (editorialDelta !== 0) {
      return editorialDelta;
    }

    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  });
}

function collectTopicSuggestions(articles: Array<Pick<ArticleSummary, "topics" | "tags">>) {
  return uniqueStrings(
    articles.flatMap((article) => [...article.topics, ...article.tags]),
  ).slice(0, 8);
}

function matchesPdfAvailability(
  article: Pick<ArticleSummary, "availability" | "pdfAvailability">,
  hasExtractedPdf?: boolean,
) {
  if (typeof hasExtractedPdf !== "boolean") {
    return true;
  }

  const availability = article.availability ?? article.pdfAvailability;
  return (availability?.hasExtractedPdf ?? false) === hasExtractedPdf;
}

function getAudienceRankingScore(
  ranking: ArticleSummary["ranking"],
  audience?: BrowseArticlesInput["audience"],
) {
  if (!ranking || !audience) {
    return 0;
  }

  const dimension = ranking.dimensions.find((item) =>
    normalizeSearchText(item.label).includes(normalizeSearchText(audience))
  );

  if (dimension) {
    return dimension.score;
  }

  return ranking.score ?? ranking.totalScore;
}

function buildRankingLabel(
  audience: BrowseArticlesInput["audience"] | undefined,
  dimensions: RankingDimension[],
) {
  const primaryDimension = dimensions[0]?.label;
  if (audience) {
    return `Editorially prioritized for ${formatAudienceLabel(audience)}.`;
  }

  if (primaryDimension) {
    return `Editorially prioritized this week for ${primaryDimension.toLowerCase()}.`;
  }

  return "Editorially prioritized this week.";
}

function buildSortReason(options: {
  feed: "top" | "search";
  sort: "editorial" | "relevance" | "recency";
  audience?: BrowseArticlesInput["audience"];
}) {
  const audienceSuffix = options.audience
    ? ` Audience lens: ${formatAudienceLabel(options.audience)}.`
    : "";

  if (options.feed === "top") {
    if (options.sort === "recency") {
      return `Sorted by publication recency within the selected top feed.${audienceSuffix}`;
    }

    return `Sorted by ReadAbstracted's editorial ranking for the selected feed.${audienceSuffix}`;
  }

  if (options.sort === "recency") {
    return `Sorted by recency after matching your query.${audienceSuffix}`;
  }

  if (options.sort === "editorial") {
    return `Sorted by editorial importance after matching your query.${audienceSuffix}`;
  }

  return `Sorted by query relevance.${audienceSuffix}`;
}

function buildMatchReason(matchedFields: DiscoveryField[], query: string) {
  if (matchedFields.length === 0) {
    return null;
  }

  const formattedFields = matchedFields.join(", ");
  return `Best match for "${query}" based on ${formattedFields}.`;
}

function resolveSuggestionReason(options: {
  requestedRef: string;
  extractedId: string | null;
  normalizedArxivId: string;
  normalizedVersionedId: string;
  paper: Pick<PaperWithContent, "id" | "arxivId" | "versionedId" | "title" | "searchText">;
}) {
  const normalizedRequestedRef = normalizeSearchText(options.requestedRef);

  if (options.extractedId && options.paper.id === options.extractedId) {
    return "Matched a ReadAbstracted paper path.";
  }

  if (
    options.paper.arxivId === options.normalizedArxivId ||
    options.paper.versionedId === options.normalizedVersionedId
  ) {
    return "Matched an arXiv identifier.";
  }

  if (normalizeSearchText(options.paper.title).includes(normalizedRequestedRef)) {
    return "Matched the article title.";
  }

  return "Matched related search text.";
}

function scoreTextField(
  value: string,
  searchTerms: string[],
  field: DiscoveryField,
  matches: Set<DiscoveryField>,
  weight: number,
) {
  const normalizedValue = normalizeSearchText(value);
  let score = 0;

  for (const term of searchTerms) {
    if (normalizedValue.includes(term)) {
      matches.add(field);
      score += weight;
    }
  }

  return score;
}

function countTermHits(value: string, searchTerms: string[]) {
  const normalizedValue = normalizeSearchText(value);
  return searchTerms.reduce((total, term) => total + (normalizedValue.includes(term) ? 1 : 0), 0);
}

function expandSearchTerms(searchTerms: string[]) {
  const expanded = new Set<string>();
  for (const term of searchTerms) {
    if (!term) {
      continue;
    }

    expanded.add(term);
    const aliases = DOMAIN_ALIASES[term] ?? [];
    for (const alias of aliases) {
      expanded.add(normalizeSearchText(alias));
    }
  }

  return Array.from(expanded);
}

function normalizeArticleReference(value: string) {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    return null;
  }

  const paperId = extractPaperIdFromUrl(trimmed);
  if (paperId) {
    return paperId;
  }

  if (looksLikeArxivReference(trimmed)) {
    return canonicalizeArxivId(trimmed).versionedId;
  }

  return trimmed;
}

function buildSearchSnippet(article: ArticleDetail, searchTerms: string[]) {
  const snippetSources = [
    article.summary.quickTake,
    article.summary.whyItMatters,
    article.analysis.whyItMatters,
    ...article.analysis.caveats,
    article.technicalBrief?.whatToIgnore,
    ...(article.technicalBrief?.bullets.map((bullet) => bullet.text) ?? []),
    article.abstract,
  ].filter((value): value is string => Boolean(value));

  const matched = snippetSources.find((value) =>
    searchTerms.some((term) => normalizeSearchText(value).includes(term))
  );

  return truncateText(matched ?? article.summary.preview ?? article.abstract, 280);
}

function extractPaperIdFromUrl(value: string) {
  if (value.startsWith("/papers/")) {
    return value.slice("/papers/".length) || null;
  }

  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/papers\/([^/]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function looksLikeArxivReference(value: string) {
  return /^https?:\/\/arxiv\.org\/abs\//i.test(value) ||
    /^oai:arXiv\.org:/i.test(value) ||
    /^\d{4}\.\d{4,5}(v\d+)?$/i.test(value);
}

function resolveSiteBaseUrl(requestOrigin?: string) {
  const configured = env.SITE_BASE_URL?.replace(/\/+$/, "");
  if (configured) {
    return configured;
  }

  if (requestOrigin) {
    return requestOrigin.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

function buildAbsoluteUrl(baseUrl: string, path: string) {
  return new URL(path, `${baseUrl}/`).toString();
}

function orderByIds<T extends { id: string }>(items: T[], ids: string[]) {
  const indexById = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort(
    (left, right) =>
      (indexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (indexById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean)),
  );
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function maxDateString(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left > right ? left : right;
}

function minDateString(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left < right ? left : right;
}

function extractLeadSentence(value: string) {
  const normalized = normalizeWhitespace(value);
  const match = normalized.match(/.+?[.!?](?:\s|$)/);
  return (match?.[0] ?? normalized).trim();
}

function truncateText(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatAudienceLabel(audience: NonNullable<BrowseArticlesInput["audience"]>) {
  if (audience === "pms") {
    return "PMs";
  }
  return audience;
}
