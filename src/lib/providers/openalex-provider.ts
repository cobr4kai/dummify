import { env } from "@/lib/env";
import type { EnrichmentContext } from "@/lib/providers";
import type { PaperSourceRecord } from "@/lib/types";

export class OpenAlexProvider {
  readonly provider = "openalex";

  isAvailable() {
    return Boolean(env.OPENALEX_API_KEY);
  }

  async enrich(paper: PaperSourceRecord, _context: EnrichmentContext) {
    if (!this.isAvailable()) {
      return null;
    }

    const params = new URLSearchParams({
      "per-page": "1",
      search: paper.title,
      api_key: env.OPENALEX_API_KEY ?? "",
    });

    const response = await fetch(
      `https://api.openalex.org/works?${params.toString()}`,
      {
        headers: {
          "User-Agent": "PaperBrief/0.1",
        },
        next: { revalidate: 0 },
      },
    );

    if (!response.ok) {
      throw new Error(`OpenAlex returned ${response.status}.`);
    }

    const json = (await response.json()) as {
      results?: Array<{
        id?: string;
        display_name?: string;
        cited_by_count?: number;
        topics?: Array<{ display_name?: string }>;
        related_works?: string[];
      }>;
    };

    const result = json.results?.[0];
    if (!result) {
      return null;
    }

    return {
      provider: this.provider,
      providerRecordId: result.id ?? null,
      payload: {
        displayName: result.display_name ?? null,
        citedByCount: result.cited_by_count ?? null,
        topics: (result.topics ?? [])
          .map((topic) => topic.display_name)
          .filter(Boolean),
        relatedWorks: result.related_works ?? [],
      },
    };
  }
}
