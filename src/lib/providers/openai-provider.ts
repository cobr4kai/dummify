import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { env } from "@/lib/env";
import type { PaperSourceRecord, StructuredPaperSummary } from "@/lib/types";
import {
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
} from "@/lib/summaries/prompts";
import { structuredPaperSummarySchema } from "@/lib/summaries/schema";

const client = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

export class OpenAISummaryProvider {
  readonly provider = "openai";
  readonly model = env.OPENAI_MODEL;

  isAvailable() {
    return Boolean(client);
  }

  async generate(paper: PaperSourceRecord): Promise<StructuredPaperSummary> {
    if (!client) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const completion = await client.chat.completions.parse({
      model: this.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: buildSummarySystemPrompt(),
        },
        {
          role: "user",
          content: buildSummaryUserPrompt(paper),
        },
      ],
      response_format: zodResponseFormat(
        structuredPaperSummarySchema,
        "paperbrief_summary",
      ),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error("OpenAI did not return a parsed summary payload.");
    }

    return parsed;
  }
}
