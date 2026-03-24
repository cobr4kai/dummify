import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { env } from "@/lib/env";
import {
  buildStructuredMetadataSystemPrompt,
  buildStructuredMetadataUserPrompt,
} from "@/lib/metadata/prompts";
import {
  buildDeterministicStructuredMetadata,
  mergeStructuredMetadataModelFields,
} from "@/lib/metadata/service";
import {
  STRUCTURED_METADATA_PROVIDER,
  structuredMetadataModelFieldsSchema,
} from "@/lib/metadata/schema";
import type { EnrichmentContext } from "@/lib/providers";
import type { PaperSourceRecord } from "@/lib/types";

const client = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

export class StructuredMetadataProvider {
  readonly provider = STRUCTURED_METADATA_PROVIDER;
  readonly model = env.OPENAI_MODEL;

  isAvailable() {
    return true;
  }

  async enrich(paper: PaperSourceRecord, context: EnrichmentContext) {
    const deterministic = buildDeterministicStructuredMetadata(paper, {
      isEditorial: context.isEditorial,
      hasPdfBackedBrief: context.hasPdfBackedBrief,
      openAlexTopics: context.currentOpenAlexTopics,
    });

    if (!client) {
      return {
        provider: this.provider,
        providerRecordId: null,
        payload: deterministic,
      };
    }

    try {
      const completion = await client.chat.completions.parse({
        model: this.model,
        messages: [
          {
            role: "system",
            content: buildStructuredMetadataSystemPrompt(),
          },
          {
            role: "user",
            content: buildStructuredMetadataUserPrompt(paper, deterministic, {
              openAlexTopics: context.currentOpenAlexTopics,
            }),
          },
        ],
        response_format: zodResponseFormat(
          structuredMetadataModelFieldsSchema,
          "paperbrief_structured_metadata",
        ),
      });

      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) {
        throw new Error("OpenAI did not return a structured metadata payload.");
      }

      return {
        provider: this.provider,
        providerRecordId: null,
        payload: mergeStructuredMetadataModelFields(deterministic, parsed),
      };
    } catch (error) {
      return {
        provider: this.provider,
        providerRecordId: null,
        payload: deterministic,
        warnings: [
          error instanceof Error
            ? `Structured metadata model fallback: ${error.message}`
            : "Structured metadata model fallback: unknown model error.",
        ],
      };
    }
  }
}
