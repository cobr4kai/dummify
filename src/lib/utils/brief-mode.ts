import type { BriefMode } from "@/lib/types";

export function parseBriefMode(value: string | null | undefined): BriefMode {
  return value?.toLowerCase() === "genai" ? "GENAI" : "BUSINESS";
}

export function toBriefModeQuery(mode: BriefMode) {
  return mode === "GENAI" ? "genai" : "business";
}

export function isGenAiMode(mode: BriefMode) {
  return mode === "GENAI";
}
