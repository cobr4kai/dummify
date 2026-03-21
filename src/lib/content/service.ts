import { BriefMode, Prisma } from "@prisma/client";
import { z } from "zod";
import {
  articleDetailSchema,
  articleResponseSchema,
  articleSearchResultSchema,
  articleSummarySchema,
  articleTechnicalBriefSchema,
  briefBulletSchema,
  briefCitationSchema,
  briefEvidenceSchema,
  briefKeyStatSchema,
  searchArticlesResponseSchema,
  topArticlesResponseSchema,
  type ArticleDetail,
  type ArticleLookupInput,
  type ArticleSummary,
  type SearchArticlesResponse,
  type SearchArticlesInput,
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

const stringArraySchema = z.array(z.string());
const openAlexPayloadSchema = z.object({
  topics: z.array(z.string()).optional(),
});
const keyStatsSchema = z.array(briefKeyStatSchema);
const bulletsSchema = z.array(briefBulletSchema);
const evidenceSchema = z.array(briefEvidenceSchema);

type SearchMatchResult = {
  relevanceScore: number;
  matchedFields: Array<"title" | "subtitle" | "abstract" | "topics" | "technicalBrief" | "tags">;
  snippet: string;
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
      weekStart: weeklyBrief.weekStart,
      topic: input.topic ?? null,
      limit: input.limit,
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
    weekStart: weeklyBrief.weekStart,
    topic: input.topic ?? null,
    limit: input.limit,
    articles,
  });
}

export async function getArticleContent(
  lookup: ArticleLookupInput,
  options: { requestOrigin?: string } = {},
) {
  const paperId = await resolvePaperIdFromLookup(lookup);
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
    article: normalizeArticleDetail(paper, options),
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

  const results: SearchArticlesResponse["results"] = papers
    .map((paper: PaperWithContent) => normalizeArticleDetail(paper, options))
    .filter((article: ArticleDetail) => matchesTopic(article, input.topic))
    .map((article: ArticleDetail) => {
      const match = scoreArticleMatch(article, input.query);
      return match.relevanceScore > 0
        ? articleSearchResultSchema.parse({
            ...articleSummarySchema.parse(article),
            relevanceScore: match.relevanceScore,
            matchedFields: match.matchedFields,
            snippet: match.snippet,
          })
        : null;
    })
    .filter((result): result is SearchArticlesResponse["results"][number] => result !== null)
    .sort((left: SearchArticlesResponse["results"][number], right: SearchArticlesResponse["results"][number]) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }

      const rightScore = right.ranking?.totalScore ?? 0;
      const leftScore = left.ranking?.totalScore ?? 0;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
    })
    .slice(0, input.limit);

  return searchArticlesResponseSchema.parse({
    query: input.query,
    topic: input.topic ?? null,
    weekStart: input.week ? getWeekStart(input.week) : null,
    startDate: dateRange?.startDate ?? null,
    endDate: dateRange?.endDate ?? null,
    limit: input.limit,
    results,
  });
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

export function matchesTopic(article: Pick<ArticleSummary, "topics" | "tags" | "categories">, topic?: string) {
  if (!topic) {
    return true;
  }

  const normalizedTopic = normalizeSearchText(topic);
  return [...article.topics, ...article.tags, ...article.categories].some(
    (value) => normalizeSearchText(value).includes(normalizedTopic),
  );
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

  if (searchTerms.length > 0) {
    const exactPhrase = normalizeSearchText(query);
    if (normalizeSearchText(article.title).includes(exactPhrase)) {
      relevanceScore += 3;
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
  options: { requestOrigin?: string },
) {
  const siteBaseUrl = resolveSiteBaseUrl(options.requestOrigin);
  const score = paper.scores[0] ?? null;
  const technicalBrief = buildTechnicalBrief(paper);
  const openAlexTopics = paper.enrichments.flatMap((enrichment: PaperWithContent["enrichments"][number]) =>
    parseJsonValue(enrichment.payload, openAlexPayloadSchema, {}).topics ?? [],
  );
  const categories = parseJsonValue(paper.categoriesJson, stringArraySchema, []);
  const sourceFeedCategories = parseJsonValue(
    paper.sourceFeedCategoriesJson,
    stringArraySchema,
    [],
  );
  const focusTags = technicalBrief?.focusTags ?? [];
  const topics = uniqueStrings([...openAlexTopics, ...focusTags, ...categories]);
  const tags = uniqueStrings([...categories, ...sourceFeedCategories, ...focusTags]);
  const subtitle = technicalBrief?.oneLineVerdict
    ? stripTechnicalBriefHeading(technicalBrief.oneLineVerdict)
    : extractLeadSentence(paper.abstract);

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
    ranking: score
      ? {
          totalScore: score.totalScore,
          rationale: score.rationale ?? null,
        }
      : null,
    summarySnippet: subtitle ? truncateText(subtitle, 280) : null,
    pdfAvailability: buildPdfAvailability(paper),
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

function buildSearchSnippet(article: ArticleDetail, searchTerms: string[]) {
  const snippetSources = [
    article.subtitle,
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

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
