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

export const articleLookupInputSchema = z
  .object({
    article_id: optionalNonEmptyStringSchema,
    url: optionalUrlOrPaperPathSchema,
    arxiv_id: optionalNonEmptyStringSchema,
  })
  .superRefine((value, context) => {
    const provided = [value.article_id, value.url, value.arxiv_id].filter(Boolean);
    if (provided.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of article_id, url, or arxiv_id.",
      });
    }
  });

export const topArticlesInputSchema = z.object({
  week: isoDateSchema.optional(),
  limit: limitSchema,
  topic: optionalNonEmptyStringSchema,
});

export const searchArticlesInputSchema = z.object({
  query: z.string().trim().min(1),
  topic: optionalNonEmptyStringSchema,
  week: isoDateSchema.optional(),
  start_date: isoDateSchema.optional(),
  end_date: isoDateSchema.optional(),
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
  extractionStatus: z.enum(["PENDING", "FETCHED", "EXTRACTED", "FAILED", "FALLBACK"]).nullable(),
  usedFallbackAbstract: z.boolean().nullable(),
  pageCount: z.number().int().nullable(),
  fileSizeBytes: z.number().int().nullable(),
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
  ranking: articleRankingSchema.nullable(),
  summarySnippet: z.string().nullable(),
  pdfAvailability: pdfAvailabilitySchema.nullable(),
});

export const articleDetailSchema = articleSummarySchema.extend({
  abstract: z.string(),
  bestAvailableText: z.string(),
  technicalBrief: articleTechnicalBriefSchema.nullable(),
  sourceReferences: z.array(sourceReferenceSchema),
});

export const topArticlesResponseSchema = z.object({
  weekStart: isoDateSchema.nullable(),
  topic: z.string().nullable(),
  limit: z.number().int().min(1).max(25),
  articles: z.array(articleSummarySchema),
});

export const articleResponseSchema = z.object({
  article: articleDetailSchema,
});

export const articleSearchResultSchema = articleSummarySchema.extend({
  relevanceScore: z.number(),
  matchedFields: z.array(
    z.enum(["title", "subtitle", "abstract", "topics", "technicalBrief", "tags"]),
  ),
  snippet: z.string(),
});

export const searchArticlesResponseSchema = z.object({
  query: z.string(),
  topic: z.string().nullable(),
  weekStart: isoDateSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  limit: z.number().int().min(1).max(25),
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
        sourceBasis: z.enum(["full-pdf", "abstract-fallback"]).nullable(),
        usedFallbackAbstract: z.boolean().nullable(),
      }),
    ),
  }),
});

export const contentApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(["invalid_request", "not_found", "internal_error"]),
    message: z.string(),
  }),
});

export type ArticleLookupInput = z.infer<typeof articleLookupInputSchema>;
export type TopArticlesInput = z.infer<typeof topArticlesInputSchema>;
export type SearchArticlesInput = z.infer<typeof searchArticlesInputSchema>;
export type CompareArticlesInput = z.infer<typeof compareArticlesInputSchema>;
export type ArticleSummary = z.infer<typeof articleSummarySchema>;
export type ArticleDetail = z.infer<typeof articleDetailSchema>;
export type TopArticlesResponse = z.infer<typeof topArticlesResponseSchema>;
export type ArticleResponse = z.infer<typeof articleResponseSchema>;
export type SearchArticlesResponse = z.infer<typeof searchArticlesResponseSchema>;
export type ArticleComparison = z.infer<typeof articleComparisonSchema>;
