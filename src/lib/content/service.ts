import { BriefMode, Prisma } from "@prisma/client";
import { z } from "zod";
import {
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
  type BrowseArticlesResponse,
  type CompareArticlesInput,
  type OpenArticleInput,
  type SearchArticlesInput,
  type SearchArticlesResponse,
  type TopArticlesInput,
} from "@repo-types/content";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
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
};
type LookupResolution = {
  paperId: string | null;
  requestedRef: string | null;
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
const numericRecordSchema = z.record(z.string(), z.number());

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

  return articleResponseSchema.parse({
    requestedRef: resolution.requestedRef,
    resolvedBy: resolution.resolvedBy,
    article: normalizeArticleDetail(paper, options),
  });
}

export async function searchArticlesContent(
  input: SearchArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const results = await performArticleSearch(input, options);

  return searchArticlesResponseSchema.parse({
    feed: "search",
    query: input.query,
    topic: input.topic ?? null,
    audience: input.audience ?? null,
    sort: resolveSearchSort(input.sort),
    weekStart: input.week ? getWeekStart(input.week) : null,
    startDate: results.dateRange?.startDate ?? null,
    endDate: results.dateRange?.endDate ?? null,
    limit: input.limit,
    hasExtractedPdf: input.has_extracted_pdf ?? null,
    topicSuggestions: collectTopicSuggestions(results.filteredArticles),
    results: results.results,
  });
}

export async function getArticlesForComparison(
  input: string[] | CompareArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const articleRefs = Array.isArray(input)
    ? input
    : (input.article_refs ?? input.article_ids ?? []);
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
    papers.map((paper) => normalizeArticleDetail(paper, options)),
    paperIds,
  );
}

export async function resolvePaperIdFromLookup(lookup: ArticleLookupInput) {
  const resolution = await resolveLookup(articleLookupInputSchema.parse(lookup));
  return resolution.paperId;
}

export async function resolveArticleReference(articleRef: string) {
  const requestedRef = normalizeWhitespace(articleRef);
  if (!requestedRef) {
    return {
      paperId: null,
      requestedRef: null,
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
      resolvedBy: "article_ref",
    } satisfies LookupResolution;
  }

  const paperPathId = extractPaperIdFromUrl(requestedRef);
  if (paperPathId) {
    return {
      paperId: paperPathId,
      requestedRef,
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
  const searchTerms = uniqueStrings([normalizeSearchText(query), ...splitKeywords(query)]);
  const matches = new Set<DiscoveryField>();
  let relevanceScore = 0;

  relevanceScore += scoreTextField(article.title, searchTerms, "title", matches, 6);
  relevanceScore += scoreTextField(article.summary.quickTake ?? "", searchTerms, "subtitle", matches, 4);
  relevanceScore += scoreTextField(article.abstract, searchTerms, "abstract", matches, 3);
  relevanceScore += scoreTextField(article.bestAvailableText, searchTerms, "technicalBrief", matches, 2);
  relevanceScore += scoreTextField(article.topics.join(" "), searchTerms, "topics", matches, 3);
  relevanceScore += scoreTextField(article.tags.join(" "), searchTerms, "tags", matches, 2);

  const exactPhrase = normalizeSearchText(query);
  if (exactPhrase && normalizeSearchText(article.title).includes(exactPhrase)) {
    relevanceScore += 3;
  }
  if (exactPhrase && normalizeSearchText(article.bestAvailableText).includes(exactPhrase)) {
    relevanceScore += 2;
  }

  return {
    relevanceScore,
    matchedFields: Array.from(matches),
    snippet: buildSearchSnippet(article, searchTerms),
    matchReason: buildMatchReason(Array.from(matches), query),
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
  const searchTerms = uniqueStrings([normalizedQuery, ...splitKeywords(input.query)]).slice(0, 8);
  const dateRange = resolveDateRange(input);
  const normalizedSort = resolveSearchSort(input.sort);

  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      technicalBriefs: {
        some: {
          isCurrent: true,
        },
      },
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
  const bestAvailableText = buildBestAvailableText(paper.abstract, technicalBrief);

  return articleDetailSchema.parse({
    ...base,
    abstract: paper.abstract,
    bestAvailableText,
    technicalBrief,
    sourceReferences: buildSourceReferences(paper, base.canonicalUrl, technicalBrief),
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
  const openAlexTopics = paper.enrichments.flatMap((enrichment) =>
    parseJsonValue(enrichment.payload, openAlexPayloadSchema, {}).topics ?? []
  );
  const categories = parseJsonValue(paper.categoriesJson, stringArraySchema, []);
  const sourceFeedCategories = parseJsonValue(paper.sourceFeedCategoriesJson, stringArraySchema, []);
  const focusTags = technicalBrief?.focusTags ?? [];
  const topics = uniqueStrings([...openAlexTopics, ...focusTags, ...categories]);
  const tags = uniqueStrings([...categories, ...sourceFeedCategories, ...focusTags]);
  const quickTake = technicalBrief?.oneLineVerdict
    ? stripTechnicalBriefHeading(technicalBrief.oneLineVerdict)
    : extractLeadSentence(paper.abstract);
  const whyItMatters = technicalBrief?.whyItMatters ?? null;
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

function buildBestAvailableText(
  abstract: string,
  technicalBrief: ReturnType<typeof buildTechnicalBrief>,
) {
  const parts = [
    abstract,
    technicalBrief?.oneLineVerdict,
    technicalBrief?.whyItMatters,
    technicalBrief?.whatToIgnore,
    ...(technicalBrief?.keyStats.map((item) => `${item.label}: ${item.value}. ${item.context}`) ?? []),
    ...(technicalBrief?.bullets.map((bullet) => bullet.text) ?? []),
  ];

  return normalizeWhitespace(parts.filter(Boolean).join(" "));
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
      resolvedBy: "article_id",
    };
  }

  if (lookup.url) {
    const paperId = extractPaperIdFromUrl(lookup.url);
    return {
      paperId,
      requestedRef: lookup.url,
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
      resolvedBy: paper ? "arxiv_id" : null,
    };
  }

  return {
    paperId: null,
    requestedRef: null,
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
  return `Matched "${query}" in ${formattedFields}.`;
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

function buildSearchSnippet(article: ArticleDetail, searchTerms: string[]) {
  const snippetSources = [
    article.summary.quickTake,
    article.summary.whyItMatters,
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
