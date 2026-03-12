import { z } from "zod";

const citationSchema = z.object({
  page: z.number().int().min(1),
  section: z.union([z.string().min(1).max(120), z.null()]),
  quote: z.union([z.string().min(3).max(220), z.null()]),
});

const focusTagSchema = z.enum([
  "models",
  "training",
  "inference",
  "infra",
  "agents",
  "data",
]);

export const chunkEvidenceSchema = z.object({
  summary: z.string().min(20).max(500),
  findings: z
    .array(
      z.object({
        claim: z.string().min(10).max(260),
        impactArea: z.enum([
          "capability",
          "training",
          "inference",
          "stack",
          "strategic",
          "caveat",
        ]),
        confidence: z.enum(["high", "medium", "low"]),
        citations: z.array(citationSchema).min(1).max(6),
      }),
    )
    .max(10),
  metrics: z
    .array(
      z.object({
        label: z.string().min(3).max(120),
        value: z.string().min(1).max(120),
        context: z.string().min(10).max(220),
        citations: z.array(citationSchema).min(1).max(6),
      }),
    )
    .max(6),
  limitations: z.array(z.string().min(8).max(220)).max(6),
});

export const technicalBriefSchema = z.object({
  oneLineVerdict: z.string().min(40).max(560),
  keyStats: z
    .array(
      z.object({
        label: z.string().min(2).max(80),
        value: z.string().min(1).max(80),
        context: z.string().min(10).max(220),
        citations: z.array(citationSchema).max(4),
      }),
    )
    .max(4),
  focusTags: z.array(focusTagSchema).max(4),
  whyItMatters: z.string().min(25).max(500),
  whatToIgnore: z.string().min(20).max(320),
  bullets: z
    .array(
      z.object({
        label: z.string().min(3).max(80),
        text: z.string().min(40).max(700),
        impactArea: z.enum([
          "thesis",
          "method-or-proposal",
          "implementation",
          "evidence",
          "assessment",
        ]),
        citations: z.array(citationSchema).max(6),
      }),
    )
    .length(5),
  confidenceNotes: z.array(z.string().min(8).max(220)).min(1).max(6),
  evidence: z
    .array(
      z.object({
        claim: z.string().min(10).max(260),
        impactArea: z.enum([
          "capability",
          "training",
          "inference",
          "stack",
          "strategic",
          "caveat",
        ]),
        confidence: z.enum(["high", "medium", "low"]),
        citations: z.array(citationSchema).max(6),
      }),
    )
    .min(3)
    .max(16),
  sourceBasis: z.enum(["full-pdf", "abstract-fallback"]),
  usedFallbackAbstract: z.boolean(),
});

export type ChunkEvidenceSchema = z.infer<typeof chunkEvidenceSchema>;
export type TechnicalBriefSchema = z.infer<typeof technicalBriefSchema>;
