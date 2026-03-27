import { z } from "zod";
import {
  analysisAudienceSchema,
  analysisEvidenceStrengthSchema,
  analysisSourceBasisSchema,
  articleAnalysisSchema,
} from "@repo-types/content";

export const STRUCTURED_METADATA_PROVIDER = "structured_metadata_v1";
export const STRUCTURED_METADATA_VERSION = STRUCTURED_METADATA_PROVIDER;

export const structuredMetadataGenerationModeSchema = z.enum([
  "hybrid",
  "deterministic_only",
]);

export const structuredMetadataModelFieldsSchema = z.object({
  thesis: z.string().min(20).max(280),
  whyItMatters: z.string().min(20).max(320),
  methodType: z.string().min(3).max(80),
  evidenceStrength: analysisEvidenceStrengthSchema,
  likelyAudience: z.array(analysisAudienceSchema).min(1).max(4),
  caveats: z.array(z.string().min(12).max(220)).min(1).max(3),
  noveltyScore: z.number().min(0).max(100),
  businessRelevanceScore: z.number().min(0).max(100),
});

export const structuredMetadataEnrichmentSchema = articleAnalysisSchema.extend({
  version: z.literal(STRUCTURED_METADATA_VERSION),
  searchText: z.string().min(1).max(2400),
  generationMode: structuredMetadataGenerationModeSchema,
});

export const openAlexEnrichmentPayloadSchema = z.object({
  displayName: z.string().nullable().optional(),
  citedByCount: z.number().int().nullable().optional(),
  topics: z.array(z.string()).optional(),
  relatedWorks: z.array(z.string()).optional(),
  matchedBy: z.enum(["doi", "arxiv_url", "title_author"]).nullable().optional(),
  institutions: z
    .array(
      z.object({
        id: z.string().nullable().optional(),
        displayName: z.string(),
        ror: z.string().nullable().optional(),
        countryCode: z.string().nullable().optional(),
        type: z.string().nullable().optional(),
        authorCount: z.number().int().positive(),
        isCorresponding: z.boolean().optional(),
      }),
    )
    .optional(),
  authorships: z
    .array(
      z.object({
        authorName: z.string(),
        institutionNames: z.array(z.string()),
        isCorresponding: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const PDF_AFFILIATIONS_PROVIDER = "pdf_affiliations_v1";

export const pdfAffiliationEnrichmentSchema = z.object({
  version: z.literal(PDF_AFFILIATIONS_PROVIDER),
  extractedFromPage: z.number().int().positive(),
  institutions: z
    .array(
      z.object({
        displayName: z.string(),
        markers: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});

export type StructuredMetadataModelFields = z.infer<
  typeof structuredMetadataModelFieldsSchema
>;
export type StructuredMetadataEnrichment = z.infer<
  typeof structuredMetadataEnrichmentSchema
>;
export type PdfAffiliationEnrichment = z.infer<typeof pdfAffiliationEnrichmentSchema>;
export type StructuredMetadataSourceBasis = z.infer<
  typeof analysisSourceBasisSchema
>;
