import { ArxivClient } from "@/lib/arxiv/client";
import type { PaperSourceRecord } from "@/lib/types";

export type ArxivBackfillProvider = {
  provider: "oai-pmh";
  fetchRange(input: {
    categories: string[];
    from: string;
    to: string;
  }): Promise<PaperSourceRecord[]>;
};

export async function fetchHistoricalRecords(input: {
  client: ArxivClient;
  categories: string[];
  from: string;
  to: string;
  provider?: ArxivBackfillProvider | null;
}) {
  if (input.provider) {
    return input.provider.fetchRange({
      categories: input.categories,
      from: input.from,
      to: input.to,
    });
  }

  return input.client.fetchHistorical(input.categories, input.from, input.to);
}
