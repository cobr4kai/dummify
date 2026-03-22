import { MockSummaryProvider } from "@/lib/providers/mock-provider";
import { MockTechnicalBriefProvider } from "@/lib/providers/mock-technical-provider";
import { OpenAISummaryProvider } from "@/lib/providers/openai-provider";
import { OpenAITechnicalBriefProvider } from "@/lib/providers/openai-technical-provider";
import { OpenAlexProvider } from "@/lib/providers/openalex-provider";
import { StructuredMetadataProvider } from "@/lib/providers/structured-metadata-provider";
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
  enrich(
    paper: PaperSourceRecord,
    context: EnrichmentContext,
  ): Promise<EnrichmentProviderResult | null>;
}

export type EnrichmentContext = {
  paperId: string;
  announcementDay: string;
  isEditorial: boolean;
  hasPdfBackedBrief: boolean;
  currentOpenAlexTopics: string[];
  currentEnrichments: Array<{
    provider: string;
    payload: Record<string, unknown>;
  }>;
};

export type EnrichmentProviderResult = {
  provider: string;
  providerRecordId: string | null;
  payload: Record<string, unknown>;
  warnings?: string[];
};

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

export function getEnrichmentProviders(): EnrichmentProvider[] {
  return [new OpenAlexProvider(), new StructuredMetadataProvider()].filter((provider) =>
    provider.isAvailable(),
  );
}

export function getEnrichmentProvider(): EnrichmentProvider | null {
  return getEnrichmentProviders()[0] ?? null;
}
