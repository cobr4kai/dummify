import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoDateTimeSchema = z.string().datetime({ offset: true });

const optionalNonEmptyStringSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().min(1).optional(),
);

const optionalUrlOrPaperPathSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z
    .string()
    .refine(
      (value) =>
        value.startsWith("/papers/") ||
        value.startsWith("http://") ||
        value.startsWith("https://"),
      "Expected a ReadAbstracted paper URL or /papers/{id} path.",
    )
    .optional(),
);

const optionalBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
    if (normalized.length === 0) {
      return undefined;
    }
  }

  return value;
}, z.boolean().optional());

const limitSchema = z.coerce.number().int().min(1).max(25).default(10);
const articleRefSchema = z.string().trim().min(1);
const articleRefListSchema = z.array(articleRefSchema).min(2).max(5);

export const audienceLensSchema = z.enum(["builders", "researchers", "investors", "pms"]);
export const browseSortSchema = z.enum(["editorial", "relevance", "recency"]);
export const browseFeedSchema = z.enum(["top", "search"]);
export const verbositySchema = z.enum(["quick", "standard", "deep"]);

export const openArticleInputSchema = z.object({
  article_ref: articleRefSchema,
  verbosity: verbositySchema.optional(),
});

export const articleLookupInputSchema = z
  .object({
    article_ref: optionalNonEmptyStringSchema,
    article_id: optionalNonEmptyStringSchema,
    url: optionalUrlOrPaperPathSchema,
    arxiv_id: optionalNonEmptyStringSchema,
    verbosity: verbositySchema.optional(),
  })
  .superRefine((value, context) => {
    const provided = [value.article_ref, value.article_id, value.url, value.arxiv_id].filter(Boolean);
    if (provided.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of article_ref, article_id, url, or arxiv_id.",
      });
    }
  });

export const browseArticlesInputSchema = z.object({
  feed: browseFeedSchema.optional(),
  query: optionalNonEmptyStringSchema,
  topic: optionalNonEmptyStringSchema,
  audience: audienceLensSchema.optional(),
  sort: browseSortSchema.optional(),
  week: isoDateSchema.optional(),
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.optional(),
  has_extracted_pdf: optionalBooleanSchema,
  limit: limitSchema,
});

export const topArticlesInputSchema = z.object({
  week: isoDateSchema.optional(),
  limit: limitSchema,
  topic: optionalNonEmptyStringSchema,
  audience: audienceLensSchema.optional(),
  sort: browseSortSchema.optional(),
  has_extracted_pdf: optionalBooleanSchema,
});

export const searchArticlesInputSchema = z.object({
  query: z.string().trim().min(1),
  topic: optionalNonEmptyStringSchema,
  audience: audienceLensSchema.optional(),
  sort: browseSortSchema.optional(),
  week: isoDateSchema.optional(),
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.optional(),
  has_extracted_pdf: optionalBooleanSchema,
  verbosity: verbositySchema.optional(),
  limit: limitSchema,
});

export const compareArticlesInputSchema = z
  .object({
    article_refs: articleRefListSchema.optional(),
    article_ids: articleRefListSchema.optional(),
    question: optionalNonEmptyStringSchema,
    verbosity: verbositySchema.optional(),
  })
  .superRefine((value, context) => {
    const provided = [value.article_refs, value.article_ids].filter(
      (candidate): candidate is string[] => Array.isArray(candidate),
    );

    if (provided.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of article_refs or article_ids.",
      });
      return;
    }

    const refs = provided[0] ?? [];
    if (new Set(refs).size !== refs.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Article references must be unique.",
      });
    }
  });

export const sourceReferenceSchema = z.object({
  label: z.string(),
  kind: z.enum(["readabstracted", "arxiv-abstract", "arxiv-pdf", "citation"]),
  sourceUrl: z.string().url(),
  page: z.number().int().positive().nullable().optional(),
  section: z.string().nullable().optional(),
});

export const briefCitationSchema = z.object({
  page: z.number().int().positive(),
  section: z.string().nullable().optional(),
  sourceUrl: z.string().url().optional(),
});

export const briefKeyStatSchema = z.object({
  label: z.string(),
  value: z.string(),
  context: z.string(),
  citations: z.array(briefCitationSchema),
});

export const briefBulletSchema = z.object({
  label: z.string(),
  text: z.string(),
  impactArea: z.enum([
    "implication",
    "watch",
    "vendor-question",
    "assumption",
    "adoption-signal",
    "limitation",
  ]),
  citations: z.array(briefCitationSchema),
});

export const briefEvidenceSchema = z.object({
  claim: z.string(),
  impactArea: z.enum([
    "capability",
    "training",
    "inference",
    "stack",
    "strategic",
    "caveat",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  citations: z.array(briefCitationSchema),
});

export const rankingDimensionSchema = z.object({
  name: z.string(),
  label: z.string(),
  score: z.number(),
  reason: z.string().nullable(),
});

export const articleRankingSchema = z.object({
  mode: z.literal("editorial"),
  label: z.string().nullable(),
  score: z.number().nullable(),
  dimensions: z.array(rankingDimensionSchema),
  whyRanked: z.string().nullable(),
  totalScore: z.number(),
  rationale: z.string().nullable(),
});

export const articleAvailabilitySchema = z.object({
  hasPdfUrl: z.boolean(),
  hasExtractedText: z.boolean(),
  hasExtractedPdf: z.boolean(),
  extractionStatus: z.enum(["PENDING", "FETCHED", "EXTRACTED", "FAILED", "FALLBACK"]).nullable(),
  usedFallbackAbstract: z.boolean().nullable(),
  pageCount: z.number().int().nullable(),
  fileSizeBytes: z.number().int().nullable(),
});

export const pdfAvailabilitySchema = articleAvailabilitySchema;

export const articleTechnicalBriefSchema = z.object({
  oneLineVerdict: z.string(),
  whyItMatters: z.string(),
  whatToIgnore: z.string(),
  focusTags: z.array(z.string()),
  confidenceNotes: z.array(z.string()),
  keyStats: z.array(briefKeyStatSchema),
  bullets: z.array(briefBulletSchema),
  evidence: z.array(briefEvidenceSchema),
  sourceBasis: z.enum(["full-pdf", "abstract-fallback"]),
  usedFallbackAbstract: z.boolean(),
});

export const analysisSourceBasisSchema = z.enum([
  "abstract_only",
  "pdf_backed",
  "editorial",
]);

export const analysisEvidenceStrengthSchema = z.enum(["low", "medium", "high"]);

export const analysisAudienceSchema = z.enum([
  "builders",
  "researchers",
  "investors",
  "pms",
]);

export const articleAnalysisSchema = z.object({
  thesis: z.string(),
  whyItMatters: z.string(),
  topicTags: z.array(z.string()),
  methodType: z.string(),
  evidenceStrength: analysisEvidenceStrengthSchema,
  likelyAudience: z.array(analysisAudienceSchema),
  caveats: z.array(z.string()),
  noveltyScore: z.number().min(0).max(100),
  businessRelevanceScore: z.number().min(0).max(100),
  sourceBasis: analysisSourceBasisSchema,
});

export const discoveryFieldSchema = z.enum([
  "title",
  "subtitle",
  "abstract",
  "topics",
  "technicalBrief",
  "tags",
  "analysis",
]);

export const articleDiscoverySchema = z.object({
  matchedOn: z.array(discoveryFieldSchema),
  matchSnippet: z.string().nullable(),
  matchReason: z.string().nullable(),
  sortReason: z.string().nullable(),
});

export const articleSummaryLayerSchema = z.object({
  preview: z.string().nullable(),
  quickTake: z.string().nullable(),
  whyItMatters: z.string().nullable(),
  whyRanked: z.string().nullable(),
  whyMatched: z.string().nullable(),
  abstract: z.string().nullable(),
});

export const articleCardSchema = z.object({
  id: z.string(),
  articleRef: z.string(),
  arxivId: z.string(),
  title: z.string(),
  canonicalUrl: z.string().url(),
  arxivUrl: z.string().url(),
  abstractUrl: z.string().url(),
  publishedAt: isoDateTimeSchema,
  announcementDay: isoDateSchema,
  weekStart: isoDateSchema,
  authors: z.array(z.string()),
  categories: z.array(z.string()),
  topics: z.array(z.string()),
  tags: z.array(z.string()),
});

export const articleSummarySchema = z.object({
  id: z.string(),
  arxivId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  canonicalUrl: z.string().url(),
  arxivUrl: z.string().url(),
  abstractUrl: z.string().url(),
  publishedAt: isoDateTimeSchema,
  announcementDay: isoDateSchema,
  weekStart: isoDateSchema,
  authors: z.array(z.string()),
  categories: z.array(z.string()),
  topics: z.array(z.string()),
  tags: z.array(z.string()),
  analysis: articleAnalysisSchema,
  ranking: articleRankingSchema.nullable(),
  summarySnippet: z.string().nullable(),
  pdfAvailability: pdfAvailabilitySchema.nullable(),
  article: articleCardSchema,
  summary: articleSummaryLayerSchema,
  availability: articleAvailabilitySchema.nullable(),
  discovery: articleDiscoverySchema.nullable(),
});

export const articleLocatorSuggestionSchema = z.object({
  articleRef: z.string(),
  title: z.string(),
  canonicalUrl: z.string().url(),
  arxivId: z.string().nullable(),
  reason: z.string().nullable(),
});

export const articleLookupMetadataSchema = z.object({
  requestedRef: z.string().nullable(),
  normalizedRef: z.string().nullable().optional(),
  resolvedBy: z.enum(["article_ref", "article_id", "canonical_url", "paper_path", "arxiv_id"]).nullable(),
  suggestions: z.array(articleLocatorSuggestionSchema).optional(),
});

export const articleDetailSchema = articleSummarySchema.extend({
  abstract: z.string(),
  bestAvailableText: z.string(),
  technicalBrief: articleTechnicalBriefSchema.nullable(),
  sourceReferences: z.array(sourceReferenceSchema),
});

export const browseArticlesResponseSchema = z.object({
  feed: browseFeedSchema,
  query: z.string().nullable(),
  topic: z.string().nullable(),
  audience: audienceLensSchema.nullable(),
  sort: browseSortSchema,
  weekStart: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  limit: z.number().int().min(1).max(25),
  hasExtractedPdf: z.boolean().nullable(),
  topicSuggestions: z.array(z.string()),
  articles: z.array(articleSummarySchema),
});

export const topArticlesResponseSchema = browseArticlesResponseSchema;

export const articleResponseSchema = z.object({
  requestedRef: z.string().nullable(),
  normalizedRef: z.string().nullable(),
  resolvedBy: z.enum(["article_ref", "article_id", "canonical_url", "paper_path", "arxiv_id"]).nullable(),
  verbosity: verbositySchema,
  article: articleDetailSchema,
});

export const articleSearchResultSchema = articleSummarySchema.extend({
  relevanceScore: z.number(),
  matchedFields: z.array(discoveryFieldSchema),
  snippet: z.string(),
});

export const searchArticlesResponseSchema = z.object({
  feed: z.literal("search"),
  query: z.string(),
  topic: z.string().nullable(),
  audience: audienceLensSchema.nullable(),
  sort: browseSortSchema,
  verbosity: verbositySchema,
  weekStart: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  limit: z.number().int().min(1).max(25),
  hasExtractedPdf: z.boolean().nullable(),
  topicSuggestions: z.array(z.string()),
  results: z.array(articleSearchResultSchema),
});

export const articleComparisonSchema = z.object({
  question: z.string().nullable(),
  verbosity: verbositySchema,
  focusTerms: z.array(z.string()),
  recommended_winner: z.object({
    articleId: z.string(),
    title: z.string(),
  }).nullable(),
  best_for: z.array(
    z.object({
      articleId: z.string(),
      title: z.string(),
      reasons: z.array(z.string()),
    }),
  ),
  why: z.string().nullable(),
  main_tradeoff: z.string().nullable(),
  articles: z.array(articleDetailSchema).min(2).max(5),
  comparison: z.object({
    commonTopics: z.array(z.string()),
    commonTags: z.array(z.string()),
    scoreRanking: z.array(
      z.object({
        articleId: z.string(),
        title: z.string(),
        totalScore: z.number().nullable(),
      }),
    ),
    publicationOrder: z.array(
      z.object({
        articleId: z.string(),
        title: z.string(),
        publishedAt: isoDateTimeSchema,
      }),
    ),
    sourceBasisByArticle: z.array(
      z.object({
        articleId: z.string(),
        sourceBasis: analysisSourceBasisSchema,
        usedFallbackAbstract: z.boolean().nullable(),
      }),
    ),
  }),
});

export const contentApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(["invalid_request", "not_found", "internal_error"]),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type OpenArticleInput = z.infer<typeof openArticleInputSchema>;
export type ArticleLookupInput = z.infer<typeof articleLookupInputSchema>;
export type BrowseArticlesInput = z.infer<typeof browseArticlesInputSchema>;
export type TopArticlesInput = z.infer<typeof topArticlesInputSchema>;
export type SearchArticlesInput = z.infer<typeof searchArticlesInputSchema>;
export type CompareArticlesInput = z.infer<typeof compareArticlesInputSchema>;
export type Verbosity = z.infer<typeof verbositySchema>;
export type ArticleCard = z.infer<typeof articleCardSchema>;
export type ArticleSummary = z.infer<typeof articleSummarySchema>;
export type ArticleLocatorSuggestion = z.infer<typeof articleLocatorSuggestionSchema>;
export type ArticleDetail = z.infer<typeof articleDetailSchema>;
export type BrowseArticlesResponse = z.infer<typeof browseArticlesResponseSchema>;
export type TopArticlesResponse = z.infer<typeof topArticlesResponseSchema>;
export type ArticleResponse = z.infer<typeof articleResponseSchema>;
export type SearchArticlesResponse = z.infer<typeof searchArticlesResponseSchema>;
export type ArticleComparison = z.infer<typeof articleComparisonSchema>;
