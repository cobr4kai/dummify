import { env } from "@/lib/env";
import type { EnrichmentContext } from "@/lib/providers";
import type { PaperSourceRecord } from "@/lib/types";
import {
  canonicalizeArxivId,
  normalizeSearchText,
  normalizeWhitespace,
  splitKeywords,
} from "@/lib/utils/strings";

type OpenAlexInstitution = {
  id?: string;
  display_name?: string;
  ror?: string | null;
  country_code?: string | null;
  type?: string | null;
};

type OpenAlexAuthorship = {
  author?: {
    display_name?: string;
  };
  institutions?: OpenAlexInstitution[];
  is_corresponding?: boolean;
};

type OpenAlexWork = {
  id?: string;
  display_name?: string;
  cited_by_count?: number;
  topics?: Array<{ display_name?: string }>;
  related_works?: string[];
  ids?: {
    doi?: string | null;
  };
  authorships?: OpenAlexAuthorship[];
  publication_year?: number | null;
  locations?: Array<{
    landing_page_url?: string | null;
  }>;
};

type OpenAlexResponse = {
  results?: OpenAlexWork[];
};

const USER_AGENT = "PaperBrief/0.1";
const OPENALEX_SELECT_FIELDS = [
  "id",
  "display_name",
  "ids",
  "publication_year",
  "cited_by_count",
  "topics",
  "related_works",
  "authorships",
  "locations",
].join(",");
const TITLE_SEARCH_LIMIT = 5;
const MIN_TITLE_OVERLAP = 0.6;
const MIN_MATCH_SCORE = 8;

export class OpenAlexProvider {
  readonly provider = "openalex";

  isAvailable() {
    return Boolean(env.OPENALEX_API_KEY);
  }

  async enrich(paper: PaperSourceRecord, _context: EnrichmentContext) {
    if (!this.isAvailable()) {
      return null;
    }

    const directMatch =
      (await this.fetchByDoiCandidates(buildDoiCandidates(paper))) ??
      (await this.fetchByArxivLandingPage(paper));
    const result =
      directMatch ??
      (await this.fetchBestTitleMatch(paper));
    if (!result) {
      return null;
    }

    return {
      provider: this.provider,
      providerRecordId: result.work.id ?? null,
      payload: {
        displayName: result.work.display_name ?? null,
        citedByCount: result.work.cited_by_count ?? null,
        topics: (result.work.topics ?? [])
          .map((topic) => topic.display_name)
          .filter(Boolean),
        relatedWorks: result.work.related_works ?? [],
        matchedBy: result.matchedBy,
        institutions: extractInstitutions(result.work),
        authorships: extractAuthorships(result.work),
      },
    };
  }

  private async fetchByDoiCandidates(
    doiCandidates: string[],
  ): Promise<{ work: OpenAlexWork; matchedBy: "doi" } | null> {
    if (doiCandidates.length === 0) {
      return null;
    }

    const params = new URLSearchParams({
      "per-page": "1",
      filter: `doi:${doiCandidates.join("|")}`,
      api_key: env.OPENALEX_API_KEY ?? "",
      select: OPENALEX_SELECT_FIELDS,
    });
    const json = await this.fetchJson(params);
    const work = json.results?.[0];
    return work ? { work, matchedBy: "doi" } : null;
  }

  private async fetchByArxivLandingPage(
    paper: PaperSourceRecord,
  ): Promise<{ work: OpenAlexWork; matchedBy: "arxiv_url" } | null> {
    const landingPageUrls = buildArxivLandingPageUrls(paper);
    if (landingPageUrls.length === 0) {
      return null;
    }

    const params = new URLSearchParams({
      "per-page": "3",
      filter: `locations.landing_page_url:${landingPageUrls.join("|")}`,
      api_key: env.OPENALEX_API_KEY ?? "",
      select: OPENALEX_SELECT_FIELDS,
    });
    const json = await this.fetchJson(params);
    const work = selectBestArxivLandingPageMatch(landingPageUrls, json.results ?? []);

    return work ? { work, matchedBy: "arxiv_url" } : null;
  }

  private async fetchBestTitleMatch(
    paper: PaperSourceRecord,
  ): Promise<{ work: OpenAlexWork; matchedBy: "title_author" } | null> {
    const params = new URLSearchParams({
      "per-page": String(TITLE_SEARCH_LIMIT),
      search: paper.title,
      api_key: env.OPENALEX_API_KEY ?? "",
      select: OPENALEX_SELECT_FIELDS,
    });
    const json = await this.fetchJson(params);
    const work = selectBestTitleMatch(paper, json.results ?? []);
    return work ? { work, matchedBy: "title_author" } : null;
  }

  private async fetchJson(params: URLSearchParams) {
    const response = await fetch(`https://api.openalex.org/works?${params.toString()}`, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`OpenAlex returned ${response.status}.`);
    }

    return (await response.json()) as OpenAlexResponse;
  }
}

function selectBestTitleMatch(paper: PaperSourceRecord, works: OpenAlexWork[]) {
  const ranked = works
    .map((work) => ({
      work,
      score: scoreWorkMatch(paper, work),
    }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];

  if (!best) {
    return null;
  }

  const titleOverlap = computeTitleOverlap(paper.title, best.work.display_name ?? "");
  if (best.score < MIN_MATCH_SCORE || titleOverlap < MIN_TITLE_OVERLAP) {
    return null;
  }

  return best.work;
}

function selectBestArxivLandingPageMatch(landingPageUrls: string[], works: OpenAlexWork[]) {
  const normalizedUrls = new Set(landingPageUrls.map(normalizeOpenAlexUrl));
  return (
    works.find((work) =>
      (work.locations ?? []).some((location) =>
        normalizedUrls.has(normalizeOpenAlexUrl(location.landing_page_url)),
      ),
    ) ?? null
  );
}

function scoreWorkMatch(paper: PaperSourceRecord, work: OpenAlexWork) {
  let score = 0;
  const normalizedTitle = normalizeSearchText(paper.title);
  const candidateTitle = normalizeSearchText(work.display_name ?? "");
  const normalizedPaperDoi = normalizeDoi(paper.doi);
  const normalizedCandidateDoi = normalizeDoi(work.ids?.doi);
  const arxivDoiCandidates = new Set(buildDoiCandidates(paper));

  if (normalizedPaperDoi && normalizedCandidateDoi === normalizedPaperDoi) {
    score += 20;
  }
  if (normalizedCandidateDoi && arxivDoiCandidates.has(normalizedCandidateDoi)) {
    score += 18;
  }

  if (candidateTitle === normalizedTitle) {
    score += 14;
  } else if (
    normalizedTitle &&
    candidateTitle &&
    (candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle))
  ) {
    score += 10;
  }

  score += Math.round(computeTitleOverlap(paper.title, work.display_name ?? "") * 10);

  const authorOverlap = countAuthorOverlap(paper.authors, work.authorships ?? []);
  score += Math.min(4, authorOverlap * 2);

  const publishedYear = paper.publishedAt.getUTCFullYear();
  if (work.publication_year && Math.abs(work.publication_year - publishedYear) <= 1) {
    score += 2;
  }

  return score;
}

function computeTitleOverlap(left: string, right: string) {
  const leftTokens = new Set(splitKeywords(left));
  const rightTokens = new Set(splitKeywords(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function countAuthorOverlap(authors: string[], authorships: OpenAlexAuthorship[]) {
  const normalizedAuthors = new Set(authors.map(normalizeAuthorName));
  let overlap = 0;

  for (const authorship of authorships) {
    const name = normalizeAuthorName(authorship.author?.display_name ?? "");
    if (name && normalizedAuthors.has(name)) {
      overlap += 1;
    }
  }

  return overlap;
}

function extractInstitutions(work: OpenAlexWork) {
  const institutions = new Map<
    string,
    {
      id: string | null;
      displayName: string;
      ror: string | null;
      countryCode: string | null;
      type: string | null;
      authorCount: number;
      isCorresponding: boolean;
    }
  >();

  for (const authorship of work.authorships ?? []) {
    for (const institution of authorship.institutions ?? []) {
      const displayName = normalizeWhitespace(institution.display_name ?? "");
      if (!displayName) {
        continue;
      }

      const key = normalizeSearchText(displayName);
      const current = institutions.get(key);
      institutions.set(key, {
        id: institution.id ?? current?.id ?? null,
        displayName,
        ror: institution.ror ?? current?.ror ?? null,
        countryCode: institution.country_code ?? current?.countryCode ?? null,
        type: institution.type ?? current?.type ?? null,
        authorCount: (current?.authorCount ?? 0) + 1,
        isCorresponding: current?.isCorresponding || Boolean(authorship.is_corresponding),
      });
    }
  }

  return Array.from(institutions.values())
    .sort((left, right) => {
      if (right.authorCount !== left.authorCount) {
        return right.authorCount - left.authorCount;
      }

      return left.displayName.localeCompare(right.displayName);
    })
    .slice(0, 8);
}

function extractAuthorships(work: OpenAlexWork) {
  return (work.authorships ?? [])
    .map((authorship) => {
      const authorName = normalizeWhitespace(authorship.author?.display_name ?? "");
      const institutionNames = uniqueStrings(
        (authorship.institutions ?? [])
          .map((institution) => normalizeWhitespace(institution.display_name ?? ""))
          .filter(Boolean),
      );

      if (!authorName) {
        return null;
      }

      return {
        authorName,
        institutionNames,
        isCorresponding: Boolean(authorship.is_corresponding),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .slice(0, 16);
}

function normalizeDoi(rawDoi?: string | null) {
  if (!rawDoi) {
    return null;
  }

  return rawDoi
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .trim()
    .toLowerCase();
}

function buildDoiCandidates(paper: PaperSourceRecord) {
  const { arxivId, versionedId } = canonicalizeArxivId(paper.versionedId || paper.arxivId);
  return uniqueStrings(
    [
      normalizeDoi(paper.doi),
      `10.48550/arxiv.${arxivId}`,
      `10.48550/arxiv.${versionedId}`,
    ].filter(Boolean) as string[],
  );
}

function buildArxivLandingPageUrls(paper: PaperSourceRecord) {
  const { arxivId, versionedId } = canonicalizeArxivId(paper.versionedId || paper.arxivId);
  return uniqueStrings([
    paper.links.abs,
    `http://arxiv.org/abs/${arxivId}`,
    `https://arxiv.org/abs/${arxivId}`,
    `http://arxiv.org/abs/${versionedId}`,
    `https://arxiv.org/abs/${versionedId}`,
    `https://doi.org/10.48550/arxiv.${arxivId}`,
    `https://doi.org/10.48550/arxiv.${versionedId}`,
  ]);
}

function normalizeAuthorName(value: string) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeOpenAlexUrl(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/g, "").toLowerCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
