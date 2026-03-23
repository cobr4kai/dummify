import { BriefMode, Prisma } from "@prisma/client";
import { z } from "zod";
import {
  articleAnalysisSchema,
  articleDetailSchema,
  articleResponseSchema,
  articleSearchResultSchema,
  articleRefSuggestionSchema,
  articleSummarySchema,
  articleTechnicalBriefSchema,
  browseArticlesResponseSchema,
  briefBulletSchema,
  briefCitationSchema,
  briefEvidenceSchema,
  briefKeyStatSchema,
  openArticleContentResponseSchema,
  type DiscoverArticlesInput,
  type BrowseArticlesInput,
  searchArticlesResponseSchema,
  topArticlesResponseSchema,
  type ArticleDetail,
  type ArticleRefSuggestion,
  type ArticleLookupInput,
  type ArticleSummary,
  type BrowseArticlesResponse,
  type OpenArticleContentResponse,
  type SearchArticlesResponse,
  type SearchArticlesInput,
  type TopArticlesInput,
} from "@repo-types/content";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  buildDeterministicStructuredMetadata,
  getOpenAlexTopics,
  getStructuredMetadataPayload,
} from "@/lib/metadata/service";
import { getWeeklyBrief } from "@/lib/search/service";
import { stripTechnicalBriefHeading } from "@/lib/technical/brief-text";
import { paperToSourceRecord } from "@/lib/papers/record";
import { getWeekEnd, getWeekStart } from "@/lib/utils/dates";
import { parseJsonValue } from "@/lib/utils/json";
import {
  canonicalizeArxivId,
  normalizeSearchText,
  normalizeWhitespace,
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

const stringArraySchema = z.array(z.string());
const keyStatsSchema = z.array(briefKeyStatSchema);
const bulletsSchema = z.array(briefBulletSchema);
const evidenceSchema = z.array(briefEvidenceSchema);

type SearchMatchResult = {
  relevanceScore: number;
  matchedFields: Array<
    "title" | "subtitle" | "abstract" | "topics" | "technicalBrief" | "tags" | "analysis"
  >;
  snippet: string;
};

type DiscoverMatchResult = {
  relevanceScore: number;
  matchedOn: string[];
  matchReason: string | null;
  matchSnippet: string | null;
};

type DiscoverArticleItem = {
  article: ArticleDetail;
  discovery: {
    rank: number;
    sort: "relevance" | "editorial" | "recency";
    matchedOn: string[];
    matchReason: string | null;
    matchSnippet: string | null;
  };
};

export async function getTopArticlesContent(
  input: TopArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const requestedWeekStart = input.week ? getWeekStart(input.week) : null;
  const weeklyBrief = await getWeeklyBrief({
    weekStart: requestedWeekStart,
    category: "all",
    sort: "score",
  });

  const paperIds = weeklyBrief.papers.map((paper) => paper.id);
  if (paperIds.length === 0) {
    return topArticlesResponseSchema.parse({
      feed: "top",
      query: null,
      weekStart: weeklyBrief.weekStart,
      startDate: null,
      endDate: null,
      topic: input.topic ?? null,
      audience: input.audience ?? null,
      sort: input.sort ?? "editorial",
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

  const articles = orderByIds(
    papers.map((paper: PaperWithContent) => normalizeArticleSummary(paper, options)),
    paperIds,
  )
    .filter((article) => matchesTopic(article, input.topic))
    .slice(0, input.limit);

  return topArticlesResponseSchema.parse({
    feed: "top",
    query: null,
    weekStart: weeklyBrief.weekStart,
    startDate: null,
    endDate: null,
    topic: input.topic ?? null,
    audience: input.audience ?? null,
    sort: input.sort ?? "editorial",
    limit: input.limit,
    hasExtractedPdf: input.has_extracted_pdf ?? null,
    topicSuggestions: collectTopicSuggestions(articles),
    articles,
  });
}

export async function getArticleContent(
  lookup: ArticleLookupInput,
  options: { requestOrigin?: string } = {},
) {
  const normalizedLookup = normalizeArticleLookup(lookup);
  const paperId = await resolvePaperIdFromLookup(normalizedLookup);
  if (!paperId) {
    return null;
  }

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: contentPaperInclude,
  });

  if (!paper) {
    return null;
  }

  return articleResponseSchema.parse({
    requestedRef: getRequestedRef(normalizedLookup),
    resolvedBy: resolveLookupMethod(normalizedLookup),
    verbosity: normalizedLookup.verbosity ?? "standard",
    article: applyVerbosityToArticle(
      normalizeArticleDetail(paper, options),
      normalizedLookup.verbosity ?? "standard",
    ),
  });
}

export async function searchArticlesContent(
  input: SearchArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const normalizedQuery = normalizeSearchText(input.query);
  const searchTerms = uniqueStrings([normalizedQuery, ...splitKeywords(input.query)]).slice(0, 8);
  const dateRange = resolveDateRange(input);

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

  const results: SearchArticlesResponse["results"] = papers
    .map((paper: PaperWithContent) => normalizeArticleDetail(paper, options))
    .filter((article: ArticleDetail) => matchesTopic(article, input.topic))
    .filter((article: ArticleDetail) => matchesAudience(article, input.audience))
    .filter((article: ArticleDetail) => matchesExtractedPdfFilter(article, input.has_extracted_pdf))
    .map((article: ArticleDetail) => applyVerbosityToArticle(article, input.verbosity ?? "standard"))
    .map((article: ArticleDetail) => {
      const match = scoreArticleMatch(article, input.query);
      return match.relevanceScore > 0
        ? articleSearchResultSchema.parse({
            ...articleSummarySchema.parse(article),
            relevanceScore: match.relevanceScore,
            matchedFields: match.matchedFields,
            snippet: match.snippet,
            summary: {
              ...article.summary,
              whyMatched: match.snippet,
            },
          })
        : null;
    })
    .filter((result): result is SearchArticlesResponse["results"][number] => result !== null)
    .sort((left: SearchArticlesResponse["results"][number], right: SearchArticlesResponse["results"][number]) =>
      compareSearchResults(left, right, input.sort ?? "relevance"),
    )
    .slice(0, input.limit);

  return searchArticlesResponseSchema.parse({
    query: input.query,
    topic: input.topic ?? null,
    audience: input.audience ?? null,
    sort: input.sort ?? "relevance",
    weekStart: input.week ? getWeekStart(input.week) : null,
    startDate: dateRange?.startDate ?? null,
    endDate: dateRange?.endDate ?? null,
    limit: input.limit,
    hasExtractedPdf: input.has_extracted_pdf ?? null,
    results,
  });
}

export async function discoverArticlesContent(
  input: DiscoverArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  const dateRange = resolveDiscoverDateRange(input);
  const query = input.query?.trim() ?? null;
  const effectiveSort = input.sort ?? (query ? "relevance" : "editorial");
  const searchTerms = query ? expandDiscoverSearchTerms(query) : [];

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
      ...(query
        ? {
            OR: buildSearchClauses(searchTerms),
          }
        : {}),
    },
    include: contentPaperInclude,
    orderBy: [{ publishedAt: "desc" }],
    take: 250,
  });

  const ranked = papers
    .map((paper: PaperWithContent) => normalizeArticleDetail(paper, options))
    .filter((article: ArticleDetail) => matchesTopic(article, input.topic))
    .filter((article: ArticleDetail) => matchesAudience(article, input.audience))
    .filter((article: ArticleDetail) => matchesPremiumFilter(article, input.has_premium_brief))
    .filter((article: ArticleDetail) => matchesExtractedPdfFilter(article, input.has_extracted_pdf))
    .map((article: ArticleDetail) => {
      const match = query
        ? scoreDiscoverArticleMatch(article, query)
        : buildBrowseMatch(article, effectiveSort);

      return {
        article,
        match,
      };
    })
    .filter((result) => (query ? result.match.relevanceScore > 0 : true))
    .sort((left, right) => compareDiscoverResults(left.article, right.article, left.match, right.match, effectiveSort))
    .slice(0, input.limit)
    .map<DiscoverArticleItem>((result, index) => ({
      article: result.article,
      discovery: {
        rank: index + 1,
        sort: effectiveSort,
        matchedOn: result.match.matchedOn,
        matchReason: result.match.matchReason,
        matchSnippet: result.match.matchSnippet,
      },
    }));

  return {
    mode: query ? "search" : "browse",
    query,
    topic: input.topic ?? null,
    audience: input.audience ?? null,
    sort: effectiveSort,
    weekStart: input.week ? getWeekStart(input.week) : null,
    startDate: dateRange?.startDate ?? null,
    endDate: dateRange?.endDate ?? null,
    limit: input.limit,
    results: ranked,
  };
}

export async function browseArticlesContent(
  input: BrowseArticlesInput,
  options: { requestOrigin?: string } = {},
) {
  if (!input.query && (input.feed ?? "top") === "top" && !input.start_date && !input.end_date) {
    const topPayload = await getTopArticlesContent(
      {
        week: input.week,
        limit: input.limit,
        topic: input.topic,
        audience: input.audience,
        sort: input.sort,
        has_extracted_pdf: input.has_extracted_pdf,
      },
      options,
    );

    return browseArticlesResponseSchema.parse({
      ...topPayload,
      articles: topPayload.articles,
    });
  }

  const discovered = await discoverArticlesContent(
    {
      query: input.query,
      topic: input.topic,
      audience: input.audience,
      sort: input.sort,
      week: input.week,
      start_date: input.start_date,
      end_date: input.end_date,
      has_premium_brief: undefined,
      has_extracted_pdf: input.has_extracted_pdf,
      limit: input.limit,
      verbosity: "standard",
    },
    options,
  );

  return browseArticlesResponseSchema.parse({
    feed: discovered.mode === "browse" ? (input.feed ?? "archive") : "archive",
    query: discovered.query,
    topic: discovered.topic,
    audience: discovered.audience,
    sort: discovered.sort,
    weekStart: discovered.weekStart,
    startDate: discovered.startDate,
    endDate: discovered.endDate,
    limit: discovered.limit,
    hasExtractedPdf: input.has_extracted_pdf ?? null,
    topicSuggestions: collectTopicSuggestions(discovered.results.map((item) => item.article)),
    articles: discovered.results.map((item) => item.article),
  });
}

export async function openArticleContent(
  input: { article_ref: string; verbosity: "quick" | "standard" | "deep" },
  options: { requestOrigin?: string } = {},
) {
  return getArticleContent(
    {
      article_ref: input.article_ref,
      article_id: undefined,
      url: undefined,
      arxiv_id: undefined,
      verbosity: input.verbosity,
    },
    options,
  );
}

export async function suggestArticleRefs(
  requestedRef: string,
  options: { requestOrigin?: string } = {},
) {
  const normalized = requestedRef.trim();
  if (!normalized) {
    return [];
  }

  const normalizedArxiv = canonicalizeArxivId(normalized);
  const papers = await prisma.paper.findMany({
    where: {
      isDemoData: false,
      OR: [
        { id: { contains: normalized } },
        { title: { contains: normalized } },
        { arxivId: { contains: normalizedArxiv.arxivId } },
        { versionedId: { contains: normalizedArxiv.versionedId } },
      ],
    },
    include: contentPaperInclude,
    orderBy: [{ publishedAt: "desc" }],
    take: 5,
  });

  return papers.map<ArticleRefSuggestion>((paper) =>
    articleRefSuggestionSchema.parse({
      articleRef: paper.id,
      title: paper.title,
      canonicalUrl: buildAbsoluteUrl(resolveSiteBaseUrl(options.requestOrigin), `/papers/${paper.id}`),
      arxivId: paper.arxivId,
      reason: buildSuggestionReason(paper, normalized),
    }),
  );
}

export async function getArticlesForComparison(
  articleIds: string[],
  options: { requestOrigin?: string } = {},
) {
  const papers = await prisma.paper.findMany({
    where: { id: { in: articleIds } },
    include: contentPaperInclude,
  });

  return orderByIds(
    papers.map((paper: PaperWithContent) => normalizeArticleDetail(paper, options)),
    articleIds,
  );
}

export async function resolvePaperIdFromLookup(lookup: ArticleLookupInput) {
  if (lookup.article_ref) {
    if (lookup.article_ref.startsWith("/papers/")) {
      return extractPaperIdFromUrl(lookup.article_ref);
    }

    if (/^https?:\/\//i.test(lookup.article_ref)) {
      const paperId = extractPaperIdFromUrl(lookup.article_ref);
      if (paperId) {
        return paperId;
      }
    }

    const direct = lookup.article_ref.trim();
    const byId = await prisma.paper.findUnique({
      where: { id: direct },
      select: { id: true },
    });
    if (byId?.id) {
      return byId.id;
    }

    const normalized = canonicalizeArxivId(lookup.article_ref);
    const byArxiv = await prisma.paper.findFirst({
      where: {
        OR: [
          { arxivId: normalized.arxivId },
          { versionedId: normalized.versionedId },
        ],
      },
      select: { id: true },
    });

    return byArxiv?.id ?? null;
  }

  if (lookup.article_id) {
    return lookup.article_id.trim();
  }

  if (lookup.url) {
    return extractPaperIdFromUrl(lookup.url);
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

    return paper?.id ?? null;
  }

  return null;
}

export function matchesTopic(
  article: Pick<ArticleSummary, "topics" | "tags" | "categories">,
  topic?: string,
) {
  if (!topic || isGenericTopicFilter(topic)) {
    return true;
  }

  const normalizedTopic = normalizeSearchText(topic);
  return [...article.topics, ...article.tags, ...article.categories].some(
    (value) => normalizeSearchText(value).includes(normalizedTopic),
  );
}

function isGenericTopicFilter(topic: string) {
  const normalizedTopic = normalizeSearchText(topic);
  return normalizedTopic === "general" || normalizedTopic === "all" || normalizedTopic === "everything";
}

export function scoreArticleMatch(article: ArticleDetail, query: string): SearchMatchResult {
  const searchTerms = uniqueStrings([normalizeSearchText(query), ...splitKeywords(query)]);
  const matches = new Set<SearchMatchResult["matchedFields"][number]>();
  let relevanceScore = 0;

  relevanceScore += scoreTextField(article.title, searchTerms, "title", matches, 6);
  relevanceScore += scoreTextField(article.subtitle ?? "", searchTerms, "subtitle", matches, 4);
  relevanceScore += scoreTextField(article.abstract, searchTerms, "abstract", matches, 3);
  relevanceScore += scoreTextField(article.bestAvailableText, searchTerms, "technicalBrief", matches, 2);
  relevanceScore += scoreTextField(article.topics.join(" "), searchTerms, "topics", matches, 3);
  relevanceScore += scoreTextField(article.tags.join(" "), searchTerms, "tags", matches, 2);
  relevanceScore += scoreTextField(buildAnalysisSearchText(article), searchTerms, "analysis", matches, 3);

  if (searchTerms.length > 0) {
    const exactPhrase = normalizeSearchText(query);
    if (normalizeSearchText(article.title).includes(exactPhrase)) {
      relevanceScore += 3;
    }
    if (normalizeSearchText(buildAnalysisSearchText(article)).includes(exactPhrase)) {
      relevanceScore += 2;
    }
    if (normalizeSearchText(article.bestAvailableText).includes(exactPhrase)) {
      relevanceScore += 2;
    }
  }

  return {
    relevanceScore,
    matchedFields: Array.from(matches),
    snippet: buildSearchSnippet(article, searchTerms),
  };
}

function normalizeArticleSummary(
  paper: PaperWithContent,
  options: { requestOrigin?: string },
): ArticleSummary {
  return articleSummarySchema.parse(buildArticleBase(paper, options));
}

function normalizeArticleDetail(
  paper: PaperWithContent,
  options: { requestOrigin?: string },
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
    article: {
      articleRef: paper.id,
      canonicalUrl: base.canonicalUrl,
      arxivId: paper.arxivId,
    },
    abstract: paper.abstract,
    bestAvailableText,
    technicalBrief,
    sourceReferences: buildSourceReferences(paper, base.canonicalUrl, technicalBrief),
  });
}

function buildArticleBase(
  paper: PaperWithContent,
  options: { requestOrigin?: string },
) {
  const siteBaseUrl = resolveSiteBaseUrl(options.requestOrigin);
  const score = paper.scores[0] ?? null;
  const technicalBrief = buildTechnicalBrief(paper);
  const analysis = buildArticleAnalysis(paper);
  const categories = parseJsonValue(paper.categoriesJson, stringArraySchema, []);
  const sourceFeedCategories = parseJsonValue(
    paper.sourceFeedCategoriesJson,
    stringArraySchema,
    [],
  );
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
  const subtitle = technicalBrief?.oneLineVerdict
    ? stripTechnicalBriefHeading(technicalBrief.oneLineVerdict)
    : analysis.thesis;
  const summarySnippetSource = technicalBrief?.whyItMatters ?? analysis.whyItMatters;

  return {
    id: paper.id,
    arxivId: paper.arxivId,
    title: paper.title,
    subtitle: subtitle || null,
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
    ranking: score
      ? {
          totalScore: score.totalScore,
          rationale: score.rationale ?? null,
        }
      : null,
    summarySnippet: truncateText(summarySnippetSource, 280),
    summary: {
      preview: truncateText(summarySnippetSource, 180),
      quickTake: subtitle || null,
      whyItMatters: technicalBrief?.whyItMatters ?? analysis.whyItMatters,
      whyRanked: score?.rationale ?? null,
      whyMatched: null,
    },
    pdfAvailability: buildPdfAvailability(paper),
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
    confidenceNotes: parseJsonValue(
      technicalBrief.confidenceNotesJson,
      stringArraySchema,
      [],
    ),
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

  return {
    hasPdfUrl: Boolean(paper.pdfUrl),
    hasExtractedText: pdfCache.extractionStatus === "EXTRACTED" && (pdfCache.pageCount ?? 0) > 0,
    hasExtractedPdf: pdfCache.extractionStatus === "EXTRACTED" && (pdfCache.pageCount ?? 0) > 0,
    extractionStatus: pdfCache.extractionStatus,
    usedFallbackAbstract: pdfCache.usedFallbackAbstract,
    pageCount: pdfCache.pageCount ?? null,
    fileSizeBytes: pdfCache.fileSizeBytes ?? null,
  };
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

function buildDiscoverMetadataText(article: ArticleDetail) {
  return normalizeWhitespace(
    [
      article.categories.join(" "),
      article.topics.join(" "),
      article.tags.join(" "),
      buildAnalysisSearchText(article),
    ].join(" "),
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
      })),
    ),
    ...(technicalBrief?.bullets ?? []).flatMap((bullet) =>
      bullet.citations.map((citation) => ({
        label: bullet.label,
        kind: "citation" as const,
        sourceUrl: citation.sourceUrl ?? paper.pdfUrl ?? paper.abstractUrl,
        page: citation.page,
        section: citation.section ?? null,
      })),
    ),
    ...(technicalBrief?.evidence ?? []).flatMap((item) =>
      item.citations.map((citation) => ({
        label: item.claim,
        kind: "citation" as const,
        sourceUrl: citation.sourceUrl ?? paper.pdfUrl ?? paper.abstractUrl,
        page: citation.page,
        section: citation.section ?? null,
      })),
    ),
  ];

  return uniqueBy([...baseReferences, ...citationReferences], (reference) =>
    `${reference.kind}:${reference.sourceUrl}:${reference.page ?? "none"}:${reference.section ?? "none"}:${reference.label}`,
  );
}

function hydrateCitations<T extends { citations: Array<z.infer<typeof briefCitationSchema>> }>(
  items: T[],
  paper: PaperWithContent,
) {
  return items.map((item) => ({
    ...item,
    citations: item.citations.map((citation) => ({
      ...citation,
      sourceUrl: citation.sourceUrl ?? paper.pdfUrl ?? paper.abstractUrl,
    })),
  }));
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
    { authorsText: { contains: term } },
  ]);
}

function resolveDiscoverDateRange(input: Pick<DiscoverArticlesInput, "week" | "start_date" | "end_date">) {
  const weekStart = input.week ? getWeekStart(input.week) : null;
  const weekEnd = weekStart ? getWeekEnd(weekStart) : null;
  const startDate = maxDateString(weekStart, input.start_date ?? null);
  const endDate = minDateString(weekEnd, input.end_date ?? null);

  if (!startDate && !endDate) {
    return null;
  }

  return { startDate, endDate };
}

function resolveDateRange(input: SearchArticlesInput) {
  const weekStart = input.week ? getWeekStart(input.week) : null;
  const weekEnd = weekStart ? getWeekEnd(weekStart) : null;
  const startDate = maxDateString(weekStart, input.start_date ?? null);
  const endDate = minDateString(weekEnd, input.end_date ?? null);

  if (!startDate && !endDate) {
    return null;
  }

  return { startDate, endDate };
}

function scoreTextField(
  value: string,
  searchTerms: string[],
  field: SearchMatchResult["matchedFields"][number],
  matches: Set<SearchMatchResult["matchedFields"][number]>,
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

function normalizeArticleLookup(lookup: ArticleLookupInput): ArticleLookupInput {
  return {
    article_ref: lookup.article_ref,
    article_id: lookup.article_ref ? undefined : lookup.article_id,
    url: lookup.article_ref ? undefined : lookup.url,
    arxiv_id: lookup.article_ref ? undefined : lookup.arxiv_id,
    verbosity: lookup.verbosity ?? "standard",
  };
}

function getRequestedRef(lookup: ArticleLookupInput) {
  return lookup.article_ref ?? lookup.article_id ?? lookup.url ?? lookup.arxiv_id ?? null;
}

function resolveLookupMethod(lookup: ArticleLookupInput) {
  if (lookup.article_ref) {
    return "article_ref" as const;
  }
  if (lookup.article_id) {
    return "article_id" as const;
  }
  if (lookup.url) {
    return "canonical_url" as const;
  }
  if (lookup.arxiv_id) {
    return "arxiv_id" as const;
  }
  return null;
}

function applyVerbosityToArticle(
  article: ArticleDetail,
  verbosity: "quick" | "standard" | "deep",
): ArticleDetail {
  const maxTextLength = verbosity === "quick" ? 320 : verbosity === "standard" ? 900 : 4000;
  const maxEvidence = verbosity === "quick" ? 1 : verbosity === "standard" ? 2 : 6;
  const maxBullets = verbosity === "quick" ? 1 : verbosity === "standard" ? 3 : 6;
  const maxKeyStats = verbosity === "quick" ? 1 : verbosity === "standard" ? 2 : 6;

  return articleDetailSchema.parse({
    ...article,
    bestAvailableText: truncateText(article.bestAvailableText, maxTextLength),
    summary: {
      ...article.summary,
      preview: truncateText(
        article.summary.preview ?? article.summary.quickTake ?? article.summarySnippet ?? article.abstract,
        verbosity === "quick" ? 120 : verbosity === "standard" ? 200 : 320,
      ),
    },
    technicalBrief: article.technicalBrief
      ? {
          ...article.technicalBrief,
          keyStats: article.technicalBrief.keyStats.slice(0, maxKeyStats),
          bullets: article.technicalBrief.bullets.slice(0, maxBullets),
          evidence: article.technicalBrief.evidence.slice(0, maxEvidence),
        }
      : null,
  });
}

function collectTopicSuggestions(articles: Pick<ArticleSummary, "topics" | "tags" | "categories">[]) {
  return uniqueStrings(
    articles.flatMap((article) => [...article.topics, ...article.tags, ...article.categories]),
  ).slice(0, 8);
}

function compareSearchResults(
  left: SearchArticlesResponse["results"][number],
  right: SearchArticlesResponse["results"][number],
  sort: "relevance" | "editorial" | "recency",
) {
  if (sort === "recency") {
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  }

  if (sort === "editorial") {
    const scoreDelta = (right.ranking?.totalScore ?? 0) - (left.ranking?.totalScore ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
  } else if (right.relevanceScore !== left.relevanceScore) {
    return right.relevanceScore - left.relevanceScore;
  }

  const rightScore = right.ranking?.totalScore ?? 0;
  const leftScore = left.ranking?.totalScore ?? 0;
  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
}

function buildSearchSnippet(article: ArticleDetail, searchTerms: string[]) {
  const snippetSources = [
    article.subtitle,
    article.analysis.whyItMatters,
    ...article.analysis.caveats,
    article.technicalBrief?.whyItMatters,
    article.technicalBrief?.whatToIgnore,
    ...(article.technicalBrief?.bullets.map((bullet) => bullet.text) ?? []),
    article.abstract,
  ].filter((value): value is string => Boolean(value));

  const normalizedTerms = searchTerms.filter(Boolean);
  const matched = snippetSources.find((value) =>
    normalizedTerms.some((term) => normalizeSearchText(value).includes(term)),
  );

  return truncateText(matched ?? article.summarySnippet ?? article.abstract, 280);
}

function scoreDiscoverArticleMatch(article: ArticleDetail, query: string): DiscoverMatchResult {
  const normalizedQuery = normalizeSearchText(query);
  const title = normalizeSearchText(article.title);
  const metadataText = buildDiscoverMetadataText(article);
  const abstractText = normalizeSearchText(article.abstract);
  const briefText = normalizeSearchText(article.bestAvailableText);
  const expandedTerms = expandDiscoverSearchTerms(query);
  const tokens = expandedTerms.filter((term) => term !== normalizedQuery);
  const matchedOn = new Set<string>();
  let relevanceScore = 0;

  if (normalizedQuery && title.includes(normalizedQuery)) {
    matchedOn.add("title");
    relevanceScore += 120;
  }

  if (
    normalizedQuery &&
    [article.categories, article.topics, article.tags].some((values) =>
      values.some((value) => normalizeSearchText(value).includes(normalizedQuery)),
    )
  ) {
    matchedOn.add("taxonomy");
    relevanceScore += 95;
  }

  const titleHits = countMatchingTerms(title, expandedTerms);
  if (titleHits > 0) {
    matchedOn.add("title");
    relevanceScore += titleHits * 18;
  }

  const metadataHits = countMatchingTerms(metadataText, expandedTerms);
  if (metadataHits > 0) {
    matchedOn.add("taxonomy");
    relevanceScore += metadataHits * 14;
  }

  const abstractHits = countMatchingTerms(abstractText, expandedTerms);
  if (abstractHits > 0) {
    matchedOn.add("abstract");
    relevanceScore += abstractHits * 9;
  }

  const briefHits = countMatchingTerms(briefText, expandedTerms);
  if (briefHits > 0) {
    matchedOn.add("brief");
    relevanceScore += briefHits * 7;
  }

  const exactTagMatch = [...article.categories, ...article.topics, ...article.tags].find((value) =>
    expandedTerms.includes(normalizeSearchText(value)),
  );

  const matchReason = title.includes(normalizedQuery)
    ? "Exact title phrase match."
    : exactTagMatch
      ? `Strong topic/category match on ${exactTagMatch}.`
      : titleHits > 0
        ? "Strong title overlap with the query."
        : metadataHits > 0
          ? "Matched on topic tags, categories, or audience cues."
          : abstractHits > 0 || briefHits > 0
            ? "Matched through abstract or brief content."
            : null;

  return {
    relevanceScore,
    matchedOn: Array.from(matchedOn),
    matchReason,
    matchSnippet: buildSearchSnippet(article, [normalizedQuery, ...tokens]),
  };
}

function buildBrowseMatch(
  article: ArticleDetail,
  sort: "relevance" | "editorial" | "recency",
): DiscoverMatchResult {
  return {
    relevanceScore: article.ranking?.totalScore ?? 0,
    matchedOn: [],
    matchReason:
      sort === "editorial"
        ? "Ordered by editorial importance across the matching archive."
        : sort === "recency"
          ? "Ordered by newest matching papers first."
          : "Ordered by discovery relevance.",
    matchSnippet: article.summarySnippet ?? article.analysis.whyItMatters ?? null,
  };
}

function compareDiscoverResults(
  leftArticle: ArticleDetail,
  rightArticle: ArticleDetail,
  leftMatch: DiscoverMatchResult,
  rightMatch: DiscoverMatchResult,
  sort: "relevance" | "editorial" | "recency",
) {
  if (sort === "recency") {
    return new Date(rightArticle.publishedAt).getTime() - new Date(leftArticle.publishedAt).getTime();
  }

  if (sort === "editorial") {
    const scoreDelta = (rightArticle.ranking?.totalScore ?? 0) - (leftArticle.ranking?.totalScore ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return new Date(rightArticle.publishedAt).getTime() - new Date(leftArticle.publishedAt).getTime();
  }

  if (rightMatch.relevanceScore !== leftMatch.relevanceScore) {
    return rightMatch.relevanceScore - leftMatch.relevanceScore;
  }

  const editorialDelta = (rightArticle.ranking?.totalScore ?? 0) - (leftArticle.ranking?.totalScore ?? 0);
  if (editorialDelta !== 0) {
    return editorialDelta;
  }

  return new Date(rightArticle.publishedAt).getTime() - new Date(leftArticle.publishedAt).getTime();
}

function expandDiscoverSearchTerms(query: string) {
  const normalized = normalizeSearchText(query);
  const terms = new Set<string>([normalized, ...splitKeywords(query)]);
  const lowercaseQuery = query.toLowerCase();

  if (lowercaseQuery.includes("robot")) {
    terms.add("robotics");
    terms.add("cs.ro");
  }

  if (lowercaseQuery.includes("agent")) {
    terms.add("agents");
    terms.add("agentic");
    terms.add("multi agent");
  }

  if (lowercaseQuery.includes("vision")) {
    terms.add("computer vision");
    terms.add("cv");
  }

  if (lowercaseQuery.includes("rag")) {
    terms.add("retrieval");
    terms.add("retrieval augmented generation");
  }

  return Array.from(terms).filter(Boolean);
}

function countMatchingTerms(value: string, terms: string[]) {
  return uniqueStrings(terms).filter((term) => value.includes(term)).length;
}

function matchesAudience(
  article: Pick<ArticleDetail, "analysis">,
  audience?: DiscoverArticlesInput["audience"],
) {
  if (!audience) {
    return true;
  }

  return article.analysis.likelyAudience.includes(audience);
}

function matchesPremiumFilter(
  article: Pick<ArticleDetail, "analysis" | "technicalBrief">,
  hasPremiumBrief?: boolean,
) {
  if (typeof hasPremiumBrief !== "boolean") {
    return true;
  }

  const hasPremium =
    article.analysis.sourceBasis === "editorial" ||
    Boolean(article.technicalBrief && !article.technicalBrief.usedFallbackAbstract);

  return hasPremiumBrief ? hasPremium : !hasPremium;
}

function matchesExtractedPdfFilter(
  article: Pick<ArticleDetail, "pdfAvailability">,
  hasExtractedPdf?: boolean,
) {
  if (typeof hasExtractedPdf !== "boolean") {
    return true;
  }

  return hasExtractedPdf
    ? article.pdfAvailability?.hasExtractedText === true
    : article.pdfAvailability?.hasExtractedText !== true;
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

function buildCompatibilityBrief(article: ArticleDetail): OpenArticleContentResponse["article"]["brief"] {
  if (!article.technicalBrief || article.technicalBrief.usedFallbackAbstract) {
    return null;
  }

  return {
    kind: article.analysis.sourceBasis === "editorial" ? "editorial" : "pdf_backed",
    highlights: uniqueStrings(
      [
        article.technicalBrief.oneLineVerdict,
        article.technicalBrief.whyItMatters,
        ...article.technicalBrief.bullets.map((bullet) => bullet.text),
      ].filter(Boolean),
    ).slice(0, 4),
    evidence: article.technicalBrief.evidence.slice(0, 3).map((item) => ({
      claim: item.claim,
      confidence: item.confidence,
    })),
  };
}

function buildSuggestionReason(paper: Pick<PaperWithContent, "id" | "arxivId" | "title">, requestedRef: string) {
  const normalizedRequested = normalizeSearchText(requestedRef);
  if (normalizeSearchText(paper.arxivId).includes(normalizedRequested)) {
    return "Matched an arXiv identifier.";
  }
  if (normalizeSearchText(paper.id).includes(normalizedRequested)) {
    return "Matched a ReadAbstracted article ID.";
  }
  return "Matched the paper title.";
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
    (left, right) => (indexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (indexById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean),
    ),
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

function hasPdfBackedBrief(
  paper: Pick<PaperWithContent, "technicalBriefs">,
) {
  return paper.technicalBriefs.some((brief) => !brief.usedFallbackAbstract);
}

function truncateText(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
