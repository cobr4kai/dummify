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

const limitSchema = z.coerce.number().int().min(1).max(25).default(10);
const verbositySchema = z.enum(["quick", "standard", "deep"]).default("standard");
const audienceFilterSchema = z.enum(["builders", "researchers", "investors", "pms"]);
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
  }

  return undefined;
}, z.boolean().optional());

export const articleLookupInputSchema = z
  .object({
    article_ref: optionalNonEmptyStringSchema,
    article_id: optionalNonEmptyStringSchema,
    url: optionalUrlOrPaperPathSchema,
    arxiv_id: optionalNonEmptyStringSchema,
    verbosity: z.enum(["quick", "standard", "deep"]).optional(),
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

export const topArticlesInputSchema = z.object({
  week: isoDateSchema.optional(),
  limit: limitSchema,
  topic: optionalNonEmptyStringSchema,
  audience: audienceFilterSchema.optional(),
  sort: z.enum(["editorial", "relevance", "recency"]).optional(),
  has_extracted_pdf: optionalBooleanSchema,
});

export const searchArticlesInputSchema = z.object({
  query: z.string().trim().min(1),
  topic: optionalNonEmptyStringSchema,
  audience: audienceFilterSchema.optional(),
  sort: z.enum(["editorial", "relevance", "recency"]).optional(),
  week: isoDateSchema.optional(),
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.optional(),
  has_extracted_pdf: optionalBooleanSchema,
  verbosity: z.enum(["quick", "standard", "deep"]).optional(),
  limit: limitSchema,
});

export const browseArticlesInputSchema = z.object({
  feed: z.enum(["top", "archive"]).optional(),
  query: optionalNonEmptyStringSchema,
  topic: optionalNonEmptyStringSchema,
  audience: audienceFilterSchema.optional(),
  sort: z.enum(["editorial", "relevance", "recency"]).optional(),
  week: isoDateSchema.optional(),
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.optional(),
  has_extracted_pdf: optionalBooleanSchema,
  limit: limitSchema,
});

export const compareArticlesInputSchema = z.object({
  article_ids: z
    .array(z.string().min(1))
    .min(2)
    .max(5)
    .superRefine((value, context) => {
      if (new Set(value).size !== value.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "article_ids must be unique.",
        });
      }
    }),
  question: optionalNonEmptyStringSchema,
});

export const openArticleInputSchema = z.object({
  article_ref: z.string().trim().min(1),
  verbosity: verbositySchema,
});

export const summarizeTopArticlesInputSchema = z.object({
  week: isoDateSchema.optional(),
  limit: limitSchema,
  topic: optionalNonEmptyStringSchema,
  verbosity: verbositySchema,
});

export const discoverArticlesSortSchema = z.enum(["relevance", "editorial", "recency"]);

export const discoverArticlesInputSchema = z.object({
  query: optionalNonEmptyStringSchema,
  topic: optionalNonEmptyStringSchema,
  audience: audienceFilterSchema.optional(),
  sort: discoverArticlesSortSchema.optional(),
  week: isoDateSchema.optional(),
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.optional(),
  has_premium_brief: optionalBooleanSchema,
  has_extracted_pdf: optionalBooleanSchema,
  limit: limitSchema,
  verbosity: verbositySchema,
});

export const compareArticlesV2InputSchema = z.object({
  article_refs: z
    .array(z.string().trim().min(1))
    .min(2)
    .max(5)
    .superRefine((value, context) => {
      if (new Set(value).size !== value.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "article_refs must be unique.",
        });
      }
    }),
  question: optionalNonEmptyStringSchema,
  verbosity: verbositySchema,
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

export const articleRankingSchema = z.object({
  totalScore: z.number(),
  rationale: z.string().nullable(),
});

export const pdfAvailabilitySchema = z.object({
  hasPdfUrl: z.boolean(),
  hasExtractedText: z.boolean(),
  hasExtractedPdf: z.boolean(),
  extractionStatus: z.enum(["PENDING", "FETCHED", "EXTRACTED", "FAILED", "FALLBACK"]).nullable(),
  usedFallbackAbstract: z.boolean().nullable(),
  pageCount: z.number().int().nullable(),
  fileSizeBytes: z.number().int().nullable(),
});

export const articleSummaryViewSchema = z.object({
  preview: z.string().nullable(),
  quickTake: z.string().nullable(),
  whyItMatters: z.string().nullable(),
  whyRanked: z.string().nullable(),
  whyMatched: z.string().nullable().optional(),
});

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
  summary: articleSummaryViewSchema,
  pdfAvailability: pdfAvailabilitySchema.nullable(),
});

export const articleDetailSchema = articleSummarySchema.extend({
  article: z
    .object({
      articleRef: z.string(),
      canonicalUrl: z.string().url(),
      arxivId: z.string(),
    })
    .optional(),
  abstract: z.string(),
  bestAvailableText: z.string(),
  technicalBrief: articleTechnicalBriefSchema.nullable(),
  sourceReferences: z.array(sourceReferenceSchema),
});

export const topArticlesResponseSchema = z.object({
  feed: z.literal("top"),
  query: z.null(),
  weekStart: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  topic: z.string().nullable(),
  audience: audienceFilterSchema.nullable(),
  sort: z.enum(["editorial", "relevance", "recency"]),
  limit: z.number().int().min(1).max(25),
  hasExtractedPdf: z.boolean().nullable(),
  topicSuggestions: z.array(z.string()),
  articles: z.array(articleSummarySchema),
});

export const articleResponseSchema = z.object({
  requestedRef: z.string().nullable(),
  resolvedBy: z.enum(["article_ref", "article_id", "canonical_url", "arxiv_id"]).nullable(),
  verbosity: verbositySchema,
  article: articleDetailSchema,
});

export const articleSearchResultSchema = articleSummarySchema.extend({
  relevanceScore: z.number(),
  matchedFields: z.array(
    z.enum(["title", "subtitle", "abstract", "topics", "technicalBrief", "tags", "analysis"]),
  ),
  snippet: z.string(),
});

export const searchArticlesResponseSchema = z.object({
  query: z.string(),
  topic: z.string().nullable(),
  audience: audienceFilterSchema.nullable(),
  sort: z.enum(["editorial", "relevance", "recency"]),
  weekStart: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  limit: z.number().int().min(1).max(25),
  hasExtractedPdf: z.boolean().nullable(),
  results: z.array(articleSearchResultSchema),
});

export const articleComparisonSchema = z.object({
  question: z.string().nullable(),
  focusTerms: z.array(z.string()),
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

export const articleRefSuggestionSchema = z.object({
  articleRef: z.string(),
  title: z.string(),
  canonicalUrl: z.string().url(),
  arxivId: z.string(),
  reason: z.string(),
});

export const browseArticlesResponseSchema = z.object({
  feed: z.enum(["top", "archive"]),
  query: z.string().nullable(),
  topic: z.string().nullable(),
  audience: audienceFilterSchema.nullable(),
  sort: z.enum(["editorial", "relevance", "recency"]),
  weekStart: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  limit: z.number().int().min(1).max(25),
  hasExtractedPdf: z.boolean().nullable(),
  topicSuggestions: z.array(z.string()),
  articles: z.array(articleSummarySchema),
});

export const openArticleContentResponseSchema = z.object({
  requestedRef: z.string(),
  normalizedRef: z.string(),
  resolvedBy: z.enum(["article_ref", "article_id", "canonical_url", "arxiv_id"]),
  verbosity: verbositySchema,
  article: z.object({
    article: z.object({
      articleRef: z.string(),
      canonicalUrl: z.string().url(),
      arxivId: z.string(),
    }),
    summary: articleSummaryViewSchema,
    content: z.object({
      abstract: z.string().nullable(),
    }),
    brief: z
      .object({
        kind: z.enum(["editorial", "pdf_backed"]),
        highlights: z.array(z.string()),
        evidence: z.array(
          z.object({
            claim: z.string(),
            confidence: z.enum(["high", "medium", "low"]),
          }),
        ),
      })
      .nullable(),
  }),
});

export const canonicalArticleAnalysisSchema = z.object({
  quickTake: z.string().nullable(),
  whyItMatters: z.string().nullable(),
  methodType: z.string().nullable(),
  likelyAudience: z.array(analysisAudienceSchema),
  topicTags: z.array(z.string()),
  caveats: z.array(z.string()),
  noveltyScore: z.number().min(0).max(100).nullable(),
  businessRelevanceScore: z.number().min(0).max(100).nullable(),
});

export const canonicalArticleProvenanceSchema = z.object({
  groundingTier: z.enum(["abstract", "pdf", "editorial"]),
  briefState: z.enum(["none", "abstract_brief", "pdf_brief", "editorial_brief"]),
  sourceUrls: z.array(z.string().url()),
});

export const canonicalArticleContentSchema = z.object({
  abstract: z.string().nullable(),
});

export const canonicalArticleBriefSchema = z
  .object({
    kind: z.enum(["editorial", "pdf_backed"]),
    highlights: z.array(z.string()),
    evidence: z.array(
      z.object({
        claim: z.string(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    ),
  })
  .nullable();

export const canonicalArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  canonicalUrl: z.string().url(),
  arxivId: z.string(),
  arxivUrl: z.string().url(),
  publishedAt: isoDateTimeSchema,
  authors: z.array(z.string()),
  categories: z.array(z.string()),
  topics: z.array(z.string()),
  tags: z.array(z.string()),
  ranking: z
    .object({
      score: z.number().nullable(),
      label: z.string().nullable(),
      whyRanked: z.string().nullable(),
    })
    .nullable(),
  analysis: canonicalArticleAnalysisSchema,
  provenance: canonicalArticleProvenanceSchema,
  content: canonicalArticleContentSchema,
  brief: canonicalArticleBriefSchema,
});

export const editionArticleResultSchema = z.object({
  article: canonicalArticleSchema,
  editionPosition: z.number().int().positive(),
  editionReason: z.string().nullable(),
});

export const summarizeTopArticlesResponseSchema = z.object({
  schemaVersion: z.literal("2"),
  edition: z.object({
    editionType: z.literal("readabstracted_weekly"),
    weekStart: isoDateSchema.nullable(),
    weekLabel: z.string().nullable(),
    isLive: z.boolean(),
    summary: z.object({
      editorialAngle: z.string().nullable(),
      whyThisWeek: z.string().nullable(),
    }),
  }),
  articles: z.array(editionArticleResultSchema),
});

export const discoverArticleResultSchema = z.object({
  article: canonicalArticleSchema,
  discovery: z.object({
    rank: z.number().int().positive(),
    sort: discoverArticlesSortSchema,
    matchedOn: z.array(z.string()),
    matchReason: z.string().nullable(),
    matchSnippet: z.string().nullable(),
  }),
});

export const discoverArticlesResponseSchema = z.object({
  schemaVersion: z.literal("2"),
  mode: z.enum(["search", "browse"]),
  query: z.string().nullable(),
  topic: z.string().nullable(),
  audience: analysisAudienceSchema.nullable(),
  sort: discoverArticlesSortSchema,
  weekStart: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  limit: z.number().int().min(1).max(25),
  results: z.array(discoverArticleResultSchema),
});

export const openArticleResponseSchema = z.object({
  schemaVersion: z.literal("2"),
  article: canonicalArticleSchema,
});

export const compareArticlesResponseSchema = z.object({
  schemaVersion: z.literal("2"),
  question: z.string().nullable(),
  articles: z.array(canonicalArticleSchema).min(2).max(5),
  comparison: z.object({
    recommendedWinner: z.string().nullable(),
    bestFor: z.string().nullable(),
    why: z.string().nullable(),
    mainTradeoff: z.string().nullable(),
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
    provenanceByArticle: z.array(
      z.object({
        articleId: z.string(),
        groundingTier: z.enum(["abstract", "pdf", "editorial"]),
        briefState: z.enum(["none", "abstract_brief", "pdf_brief", "editorial_brief"]),
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

export type ArticleLookupInput = z.infer<typeof articleLookupInputSchema>;
export type TopArticlesInput = z.infer<typeof topArticlesInputSchema>;
export type SearchArticlesInput = z.infer<typeof searchArticlesInputSchema>;
export type CompareArticlesInput = z.infer<typeof compareArticlesInputSchema>;
export type BrowseArticlesInput = z.infer<typeof browseArticlesInputSchema>;
export type ArticleSummary = z.infer<typeof articleSummarySchema>;
export type ArticleDetail = z.infer<typeof articleDetailSchema>;
export type TopArticlesResponse = z.infer<typeof topArticlesResponseSchema>;
export type ArticleResponse = z.infer<typeof articleResponseSchema>;
export type SearchArticlesResponse = z.infer<typeof searchArticlesResponseSchema>;
export type BrowseArticlesResponse = z.infer<typeof browseArticlesResponseSchema>;
export type OpenArticleContentResponse = z.infer<typeof openArticleContentResponseSchema>;
export type ArticleRefSuggestion = z.infer<typeof articleRefSuggestionSchema>;
export type ArticleComparison = z.infer<typeof articleComparisonSchema>;
export type OpenArticleInput = z.infer<typeof openArticleInputSchema>;
export type SummarizeTopArticlesInput = z.infer<typeof summarizeTopArticlesInputSchema>;
export type DiscoverArticlesInput = z.infer<typeof discoverArticlesInputSchema>;
export type CompareArticlesV2Input = z.infer<typeof compareArticlesV2InputSchema>;
export type CanonicalArticle = z.infer<typeof canonicalArticleSchema>;
export type SummarizeTopArticlesResponse = z.infer<typeof summarizeTopArticlesResponseSchema>;
export type DiscoverArticlesResponse = z.infer<typeof discoverArticlesResponseSchema>;
export type OpenArticleResponse = z.infer<typeof openArticleResponseSchema>;
export type CompareArticlesResponse = z.infer<typeof compareArticlesResponseSchema>;
