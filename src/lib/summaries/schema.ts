import { z } from "zod";

export const structuredPaperSummarySchema = z.object({
  oneSentenceSummary: z.string().min(12).max(220),
  whyThisMatters: z.string().min(40).max(900),
  audienceInterpretations: z.object({
    strategy: z.string().min(20).max(500),
    finance: z.string().min(20).max(500),
    procurement: z.string().min(20).max(500),
  }),
  whatThisIsNot: z.string().min(20).max(500),
  confidenceNotes: z.array(z.string().min(10).max(220)).min(1).max(4),
  jargonBuster: z
    .array(
      z.object({
        term: z.string().min(2).max(80),
        definition: z.string().min(8).max(220),
      }),
    )
    .min(2)
    .max(8),
  keyClaims: z
    .array(
      z.object({
        claim: z.string().min(10).max(260),
        supportLevel: z.enum(["explicit", "inferred"]),
      }),
    )
    .min(2)
    .max(6),
  businessConsequences: z
    .array(
      z.object({
        consequence: z.string().min(12).max(260),
        audience: z.enum(["all", "strategy", "finance", "procurement"]),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .min(2)
    .max(6),
  maturityEstimate: z.enum([
    "RESEARCH_ONLY",
    "NEAR_TERM_PROTOTYPE",
    "LIKELY_PRODUCTIZABLE",
    "INFRA_PLATFORM_RELEVANT",
  ]),
  leadershipQuestions: z.array(z.string().min(10).max(180)).max(5),
});

export type StructuredPaperSummarySchema = z.infer<
  typeof structuredPaperSummarySchema
>;
