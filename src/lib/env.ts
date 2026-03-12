import { z } from "zod";
import {
  DEFAULT_ENABLE_PREMIUM_SYNTHESIS,
  DEFAULT_OPENAI_EXTRACTION_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_SYNTHESIS_MODEL,
} from "@/config/defaults";

const optionalNonEmptyString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().min(1).optional(),
);

const envSchema = z.object({
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_MODEL: z.string().default(DEFAULT_OPENAI_MODEL),
  OPENAI_EXTRACTION_MODEL: z.string().default(DEFAULT_OPENAI_EXTRACTION_MODEL),
  OPENAI_SYNTHESIS_MODEL: z.string().default(DEFAULT_OPENAI_SYNTHESIS_MODEL),
  OPENAI_ENABLE_PREMIUM_SYNTHESIS: z
    .enum(["true", "false"])
    .default(DEFAULT_ENABLE_PREMIUM_SYNTHESIS ? "true" : "false")
    .transform((value) => value === "true"),
  OPENALEX_API_KEY: optionalNonEmptyString,
  ADMIN_PASSWORD: optionalNonEmptyString,
  CRON_SECRET: optionalNonEmptyString,
  ENABLE_LOCAL_CRON: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const env = envSchema.parse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_EXTRACTION_MODEL: process.env.OPENAI_EXTRACTION_MODEL,
  OPENAI_SYNTHESIS_MODEL: process.env.OPENAI_SYNTHESIS_MODEL,
  OPENAI_ENABLE_PREMIUM_SYNTHESIS: process.env.OPENAI_ENABLE_PREMIUM_SYNTHESIS,
  OPENALEX_API_KEY: process.env.OPENALEX_API_KEY,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  CRON_SECRET: process.env.CRON_SECRET,
  ENABLE_LOCAL_CRON: process.env.ENABLE_LOCAL_CRON,
});
