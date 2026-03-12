import { MockSummaryProvider } from "@/lib/providers/mock-provider";
import { MockTechnicalBriefProvider } from "@/lib/providers/mock-technical-provider";
import { OpenAISummaryProvider } from "@/lib/providers/openai-provider";
import { OpenAITechnicalBriefProvider } from "@/lib/providers/openai-technical-provider";
import { OpenAlexProvider } from "@/lib/providers/openalex-provider";
import type {
  PaperSourceRecord,
  PdfPageText,
  StructuredPaperSummary,
  StructuredTechnicalBrief,
} from "@/lib/types";

export interface SummaryProvider {
  readonly provider: string;
  readonly model: string;
  isAvailable(): boolean;
  generate(paper: PaperSourceRecord): Promise<StructuredPaperSummary>;
}

export interface TechnicalBriefProvider {
  readonly provider: string;
  readonly extractionModel: string;
  readonly synthesisModel: string;
  isAvailable(): boolean;
  resolveModel(usePremiumSynthesis: boolean): string;
  generate(
    paper: PaperSourceRecord,
    input: {
      pages: PdfPageText[];
      sourceBasis: "full-pdf" | "abstract-fallback";
      usePremiumSynthesis: boolean;
    },
  ): Promise<StructuredTechnicalBrief>;
}

export interface EnrichmentProvider {
  readonly provider: string;
  isAvailable(): boolean;
  enrich(paper: PaperSourceRecord): Promise<{
    provider: string;
    providerRecordId: string | null;
    payload: Record<string, unknown>;
  } | null>;
}

export function getSummaryProvider(): SummaryProvider | null {
  const openAIProvider = new OpenAISummaryProvider();
  if (openAIProvider.isAvailable()) {
    return openAIProvider;
  }

  return null;
}

export function getMockSummaryProvider() {
  return new MockSummaryProvider();
}

export function getTechnicalBriefProvider(): TechnicalBriefProvider | null {
  const provider = new OpenAITechnicalBriefProvider();
  return provider.isAvailable() ? provider : null;
}

export function getMockTechnicalBriefProvider() {
  return new MockTechnicalBriefProvider();
}

export function getEnrichmentProvider(): EnrichmentProvider | null {
  const provider = new OpenAlexProvider();
  return provider.isAvailable() ? provider : null;
}
