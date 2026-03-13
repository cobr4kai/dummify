import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { env } from "@/lib/env";
import type {
  ChunkEvidencePayload,
  PaperSourceRecord,
  StructuredTechnicalBrief,
} from "@/lib/types";
import {
  buildChunkEvidenceSystemPrompt,
  buildChunkEvidenceUserPrompt,
  buildTechnicalBriefSystemPrompt,
  buildTechnicalBriefUserPrompt,
} from "@/lib/technical/prompts";
import { normalizeTechnicalBriefLead } from "@/lib/technical/brief-text";
import { chunkEvidenceSchema, technicalBriefSchema } from "@/lib/technical/schema";
import { chunkPdfPages } from "@/lib/pdf/service";

const client = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

export class OpenAITechnicalBriefProvider {
  readonly provider = "openai";
  readonly extractionModel = env.OPENAI_EXTRACTION_MODEL;
  readonly synthesisModel = env.OPENAI_SYNTHESIS_MODEL;

  isAvailable() {
    return Boolean(client);
  }

  resolveModel(usePremiumSynthesis: boolean) {
    return resolveTechnicalSynthesisModel(usePremiumSynthesis);
  }

  async generate(
    paper: PaperSourceRecord,
    input: {
      pages: Array<{ pageNumber: number; text: string }>;
      sourceBasis: "full-pdf" | "abstract-fallback";
      usePremiumSynthesis: boolean;
    },
  ): Promise<StructuredTechnicalBrief> {
    if (!client) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const evidencePayloads =
      input.pages.length === 0
        ? [
            {
              summary:
                "Full PDF extraction was unavailable, so only abstract-level fallback context is available.",
              findings: [],
              metrics: [],
              limitations: ["No page-level PDF evidence was available during analysis."],
            } satisfies ChunkEvidencePayload,
          ]
        : await Promise.all(
            chunkPdfPages(input.pages).map(async (pageChunk) => {
              const completion = await client.chat.completions.parse({
                model: this.extractionModel,
                messages: [
                  {
                    role: "system",
                    content: buildChunkEvidenceSystemPrompt(),
                  },
                  {
                    role: "user",
                    content: buildChunkEvidenceUserPrompt(paper, pageChunk),
                  },
                ],
                response_format: zodResponseFormat(
                  chunkEvidenceSchema,
                  "paperbrief_chunk_evidence",
                ),
              });

              const parsed = completion.choices[0]?.message.parsed;
              if (!parsed) {
                throw new Error("OpenAI did not return parsed chunk evidence.");
              }

              return parsed;
            }),
          );

    const mergedEvidence = normalizeChunkEvidence(evidencePayloads);
    const completion = await client.chat.completions.parse({
      model: this.resolveModel(input.usePremiumSynthesis),
      messages: [
        {
          role: "system",
          content: buildTechnicalBriefSystemPrompt(),
        },
        {
          role: "user",
          content: buildTechnicalBriefUserPrompt(
            paper,
            mergedEvidence,
            input.sourceBasis,
          ),
        },
      ],
      response_format: zodResponseFormat(
        technicalBriefSchema,
        "paperbrief_technical_brief",
      ),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error("OpenAI did not return a parsed technical brief payload.");
    }

    return {
      ...parsed,
      oneLineVerdict: normalizeHookText(parsed.oneLineVerdict),
    };
  }
}

export function resolveTechnicalSynthesisModel(usePremiumSynthesis: boolean) {
  if (env.OPENAI_ENABLE_PREMIUM_SYNTHESIS && usePremiumSynthesis) {
    return env.OPENAI_SYNTHESIS_MODEL;
  }

  return env.OPENAI_EXTRACTION_MODEL;
}

export function normalizeChunkEvidence(payloads: ChunkEvidencePayload[]) {
  return payloads.map((payload) => ({
    summary: payload.summary,
    findings: payload.findings.slice(0, 8),
    metrics: payload.metrics.slice(0, 4),
    limitations: payload.limitations.slice(0, 4),
  }));
}

export function normalizeHookText(hook: string) {
  const normalized = normalizeTechnicalBriefLead(hook);

  if (/[.!?]["')\]]*$/.test(normalized)) {
    return normalized;
  }

  const sentenceMatches = [...normalized.matchAll(/[.!?]["')\]]*(?=\s|$)/g)];
  const lastCompleteSentence = sentenceMatches.at(-1);

  if (lastCompleteSentence) {
    const endIndex =
      (lastCompleteSentence.index ?? 0) + lastCompleteSentence[0].length;
    return normalized.slice(0, endIndex).trim();
  }

  const trimmed = normalized.replace(/[\s,;:/"'“”‘’)\]]+$/g, "").trim();
  return trimmed ? `${trimmed}.` : normalized;
}
