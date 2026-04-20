import path from "node:path";
import type { PaperSourceRecord } from "@/lib/types";
import type { DailyFeedEntry } from "@/lib/arxiv/parsers";
import {
  getDefaultArxivRequestGate,
  type ArxivLane,
  type ArxivRequestGate,
} from "@/lib/arxiv/request-gate";
import { buildHistoricalQuery } from "@/lib/arxiv/query-builder";
import {
  extractAbstractFromDailyDescription,
  parseAtomFeed,
  parseDailyFeed,
} from "@/lib/arxiv/parsers";
import {
  readCachedHttpResponse,
  writeCachedHttpResponse,
} from "@/lib/arxiv/http-cache";
import { toAnnouncementDay } from "@/lib/utils/dates";

const API_BASE_URL = "https://export.arxiv.org/api/query";
const RSS_BASE_URL = "https://rss.arxiv.org/rss";

export type ArxivProgressEvent =
  | {
      type: "discover-category";
      category: string;
      processedCategories: number;
      totalCategories: number;
      discoveredCount: number;
    }
  | {
      type: "hydrate-batch";
      processed: number;
      total: number;
      batchSize: number;
    }
  | {
      type: "wait";
      lane: ArxivLane;
      delayMs: number;
      reason: "min-delay" | "retry-backoff" | "retry-after";
    };

export type ArxivClientOptions = {
  apiBaseUrl?: string;
  rssBaseUrl?: string;
  cacheRoot?: string;
  apiMinDelayMs?: number;
  rssMinDelayMs?: number;
  retryBaseDelayMs?: number;
  apiCacheTtlMinutes?: number;
  feedCacheTtlMinutes?: number;
  fetchFn?: typeof fetch;
  nowFn?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
  userAgent?: string;
  requestGate?: ArxivRequestGate;
  onProgress?: (event: ArxivProgressEvent) => Promise<void> | void;
};

type FetchXmlOptions = {
  bypassCache?: boolean;
};

type ResolvedArxivClientOptions = Omit<Required<ArxivClientOptions>, "cacheRoot" | "onProgress"> & {
  cacheRoot?: string;
  onProgress?: ArxivClientOptions["onProgress"];
};

export type HistoricalFetchResult = {
  records: PaperSourceRecord[];
  warnings: string[];
};

export class ArxivClient {
  private readonly options: ResolvedArxivClientOptions;
  private nextApiAllowedAt = 0;
  private nextRssAllowedAt = 0;
  private static readonly MAX_FETCH_ATTEMPTS = 4;
  private static readonly RATE_LIMIT_COOLDOWN_MULTIPLIER = 4;
  private static readonly MIN_RATE_LIMIT_COOLDOWN_MS = 12_000;

  constructor(options: ArxivClientOptions = {}) {
    this.options = {
      apiBaseUrl: options.apiBaseUrl ?? API_BASE_URL,
      rssBaseUrl: options.rssBaseUrl ?? RSS_BASE_URL,
      cacheRoot: options.cacheRoot
        ? path.resolve(options.cacheRoot)
        : undefined,
      apiMinDelayMs: options.apiMinDelayMs ?? 3100,
      rssMinDelayMs: options.rssMinDelayMs ?? 1000,
      retryBaseDelayMs: options.retryBaseDelayMs ?? 800,
      apiCacheTtlMinutes: options.apiCacheTtlMinutes ?? 180,
      feedCacheTtlMinutes: options.feedCacheTtlMinutes ?? 60,
      fetchFn: options.fetchFn ?? fetch,
      nowFn: options.nowFn ?? Date.now,
      sleepFn: options.sleepFn ?? sleep,
      userAgent: options.userAgent ?? "PaperBrief/0.1",
      requestGate: options.requestGate ?? getDefaultArxivRequestGate(),
      onProgress: options.onProgress,
    };
  }

  async fetchDaily(categories: string[], date: string) {
    const discoveredById = new Map<string, DailyFeedEntry>();

    for (const entry of await this.discoverDailyEntries(categories, date)) {
      const existing = discoveredById.get(entry.arxivId);
      if (existing) {
        existing.categories = Array.from(
          new Set([...existing.categories, ...entry.categories]),
        );
        existing.sourceFeedCategories = Array.from(
          new Set([...existing.sourceFeedCategories, ...entry.sourceFeedCategories]),
        );
      } else {
        discoveredById.set(entry.arxivId, { ...entry });
      }
    }

    const ids = Array.from(discoveredById.keys());
    const hydratedById = await this.hydrateByIds(ids);

    return ids.map((id) => {
      const feedEntry = discoveredById.get(id);
      const hydrated = hydratedById.get(id);

      if (hydrated && feedEntry) {
        return {
          ...hydrated,
          announcementDay: feedEntry.announcementDay,
          announceType: feedEntry.announceType,
          categories: Array.from(
            new Set([...hydrated.categories, ...feedEntry.categories]),
          ),
          sourceFeedCategories: feedEntry.sourceFeedCategories,
          sourceMetadata: {
            ...hydrated.sourceMetadata,
            sourceType: "arxiv-rss+api",
            sourceFeedCategories: feedEntry.sourceFeedCategories,
            announceType: feedEntry.announceType,
          },
          sourcePayload: {
            api: hydrated.sourcePayload,
            rss: feedEntry.raw,
          },
        };
      }

      if (!feedEntry) {
        throw new Error(`Missing feed record for ${id}.`);
      }

      const raw = feedEntry.raw;
      return {
        arxivId: feedEntry.arxivId,
        version: feedEntry.version,
        versionedId: feedEntry.versionedId,
        title: typeof raw.title === "string" ? raw.title : id,
        abstract: extractAbstractFromDailyDescription(String(raw.description ?? "")),
        authors:
          typeof raw.creator === "string"
            ? raw.creator.split(",").map((author) => author.trim())
            : [],
        categories: feedEntry.categories,
        sourceFeedCategories: feedEntry.sourceFeedCategories,
        primaryCategory: feedEntry.categories[0],
        publishedAt: new Date(`${feedEntry.announcementDay}T00:00:00.000Z`),
        updatedAt: new Date(`${feedEntry.announcementDay}T00:00:00.000Z`),
        announcementDay: feedEntry.announcementDay,
        announceType: feedEntry.announceType,
        comment: null,
        journalRef: null,
        doi: null,
        links: {
          abs:
            typeof raw.link === "string"
              ? raw.link
              : `https://arxiv.org/abs/${feedEntry.arxivId}`,
        },
        sourceMetadata: {
          sourceType: "arxiv-rss-fallback",
          sourceFeedCategories: feedEntry.sourceFeedCategories,
          announceType: feedEntry.announceType,
        },
        sourcePayload: raw,
      };
    });
  }

  async fetchHistorical(categories: string[], from: string, to: string) {
    const query = buildHistoricalQuery(categories, from, to);
    const records: PaperSourceRecord[] = [];
    const warnings: string[] = [];
    let start = 0;
    const maxResults = 100;

    while (true) {
      let xml: string;
      try {
        xml = await this.fetchXml(
          `${this.options.apiBaseUrl}?${new URLSearchParams({
            search_query: query,
            sortBy: "submittedDate",
            sortOrder: "descending",
            start: start.toString(),
            max_results: maxResults.toString(),
          }).toString()}`,
          "api",
        );
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Historical metadata request for ${from} to ${to} stopped at offset ${start}: ${error.message}`
            : `Historical metadata request for ${from} to ${to} stopped at offset ${start}.`,
        );
        break;
      }

      const papers = parseAtomFeed(xml).map((paper) => ({
        ...paper,
        announcementDay: toAnnouncementDay(paper.publishedAt),
        announceType: "historical",
        sourceFeedCategories: [],
        sourceMetadata: {
          ...paper.sourceMetadata,
          sourceType: "arxiv-api-historical",
          requestedFrom: from,
          requestedTo: to,
        },
      }));

      records.push(...papers);

      if (papers.length < maxResults) {
        break;
      }

      start += maxResults;
    }

    return {
      records,
      warnings,
    };
  }

  async fetchByArxivId(arxivId: string, options: FetchXmlOptions = {}) {
    const xml = await this.fetchXml(
      `${this.options.apiBaseUrl}?${new URLSearchParams({
        id_list: arxivId,
        start: "0",
        max_results: "1",
      }).toString()}`,
      "api",
      options,
    );

    return parseAtomFeed(xml)[0] ?? null;
  }

  private async fetchXml(url: string, lane: "api" | "rss", options: FetchXmlOptions = {}) {
    const cacheTtlMinutes =
      lane === "api"
        ? this.options.apiCacheTtlMinutes
        : this.options.feedCacheTtlMinutes;
    const nowMs = this.options.nowFn();
    const cached = options.bypassCache
      ? null
      : await readCachedHttpResponse({
          cacheRoot: this.options.cacheRoot,
          lane,
          nowMs,
          ttlMinutes: cacheTtlMinutes,
          url,
        });

    if (cached) {
      return cached;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < ArxivClient.MAX_FETCH_ATTEMPTS; attempt += 1) {
      try {
        await this.waitForLane(lane);

        const response = await this.options.fetchFn(url, {
          headers: {
            "User-Agent": this.options.userAgent,
          },
          next: { revalidate: 0 },
        });

        if (response.ok) {
          const body = await response.text();
          await writeCachedHttpResponse(
            {
              cacheRoot: this.options.cacheRoot,
              lane,
              nowMs: this.options.nowFn(),
              ttlMinutes: cacheTtlMinutes,
              url,
            },
            body,
          );
          return body;
        }

        if (!isRetryableStatus(response.status)) {
          throw new NonRetryableArxivError(`arXiv returned ${response.status}.`);
        }

        throw new RetryableArxivError(`arXiv returned ${response.status}.`, {
          status: response.status,
          retryAfterMs: parseRetryAfterMs(
            response.headers.get("retry-after"),
            this.options.nowFn(),
          ),
        });
      } catch (error) {
        if (error instanceof NonRetryableArxivError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error("Unknown fetch error");
        if (attempt === ArxivClient.MAX_FETCH_ATTEMPTS - 1) {
          break;
        }

        const backoff = this.computeRetryDelayMs(
          lane,
          attempt,
          error instanceof RetryableArxivError ? error : null,
        );
        await this.applyRetryPenalty(lane, backoff);
        await this.emitProgress({
          type: "wait",
          lane,
          delayMs: backoff,
          reason:
            error instanceof RetryableArxivError && error.retryAfterMs
              ? "retry-after"
              : "retry-backoff",
        });
        await this.options.sleepFn(backoff);
      }
    }

    throw lastError ?? new Error("Failed to fetch arXiv XML.");
  }

  private async discoverDailyEntries(categories: string[], date: string) {
    const entries: DailyFeedEntry[] = [];

    for (const [index, category] of categories.entries()) {
      const xml = await this.fetchXml(`${this.options.rssBaseUrl}/${category}`, "rss");
      const discovered = parseDailyFeed(xml, category).filter(
        (entry) => entry.announcementDay === date && entry.announceType === "new",
      );
      entries.push(...discovered);
      await this.emitProgress({
        type: "discover-category",
        category,
        processedCategories: index + 1,
        totalCategories: categories.length,
        discoveredCount: discovered.length,
      });
    }

    return entries;
  }

  private async hydrateByIds(ids: string[]) {
    const hydratedById = new Map<string, PaperSourceRecord>();
    let processed = 0;

    for (const batch of chunk(ids, 25)) {
      await this.hydrateBatch(batch, hydratedById);
      processed += batch.length;
      await this.emitProgress({
        type: "hydrate-batch",
        processed,
        total: ids.length,
        batchSize: batch.length,
      });
    }

    return hydratedById;
  }

  private async waitForLane(lane: ArxivLane) {
    const minDelay = lane === "api" ? this.options.apiMinDelayMs : this.options.rssMinDelayMs;
    await this.options.requestGate.waitForTurn(lane, minDelay);
    const nowMs = this.options.nowFn();
    const nextAllowedAt = lane === "api" ? this.nextApiAllowedAt : this.nextRssAllowedAt;
    const delay = Math.max(0, nextAllowedAt - nowMs);

    if (delay > 0) {
      await this.emitProgress({
        type: "wait",
        lane,
        delayMs: delay,
        reason: "min-delay",
      });
      await this.options.sleepFn(delay);
    }

    const nextWindowStart = this.options.nowFn() + minDelay;
    if (lane === "api") {
      this.nextApiAllowedAt = nextWindowStart;
    } else {
      this.nextRssAllowedAt = nextWindowStart;
    }
  }

  private async applyRetryPenalty(lane: ArxivLane, penaltyMs: number) {
    const nextAllowedAt = this.options.nowFn() + penaltyMs;
    await this.options.requestGate.applyPenalty(lane, penaltyMs);

    if (lane === "api") {
      this.nextApiAllowedAt = Math.max(this.nextApiAllowedAt, nextAllowedAt);
    } else {
      this.nextRssAllowedAt = Math.max(this.nextRssAllowedAt, nextAllowedAt);
    }
  }

  private computeRetryDelayMs(
    lane: ArxivLane,
    attempt: number,
    retryableError: RetryableArxivError | null,
  ) {
    const minDelay = lane === "api" ? this.options.apiMinDelayMs : this.options.rssMinDelayMs;
    const exponentialDelay =
      this.options.retryBaseDelayMs * 2 ** attempt + Math.round(Math.random() * 250);
    const retryAfterDelay = retryableError?.retryAfterMs ?? 0;
    const rateLimitDelay =
      retryableError && (retryableError.status === 429 || retryableError.status === 403)
        ? Math.max(
            minDelay * ArxivClient.RATE_LIMIT_COOLDOWN_MULTIPLIER,
            ArxivClient.MIN_RATE_LIMIT_COOLDOWN_MS,
          )
        : 0;

    return Math.max(exponentialDelay, retryAfterDelay, rateLimitDelay);
  }

  private async hydrateBatch(
    batch: string[],
    hydratedById: Map<string, PaperSourceRecord>,
  ): Promise<void> {
    try {
      const xml = await this.fetchXml(
        `${this.options.apiBaseUrl}?${new URLSearchParams({
          id_list: batch.join(","),
          start: "0",
          max_results: batch.length.toString(),
        }).toString()}`,
        "api",
      );

      for (const paper of parseAtomFeed(xml)) {
        hydratedById.set(paper.arxivId, paper);
      }
    } catch (error) {
      if (!(error instanceof RetryableArxivError)) {
        throw error;
      }

      if (batch.length === 1) {
        console.warn(
          `Skipping arXiv API hydration for ${batch[0]} after repeated retryable failures; daily ingest will fall back to RSS metadata.`,
        );
        return;
      }

      const midpoint = Math.ceil(batch.length / 2);
      await this.options.sleepFn(this.options.apiMinDelayMs);
      await this.hydrateBatch(batch.slice(0, midpoint), hydratedById);
      await this.hydrateBatch(batch.slice(midpoint), hydratedById);
    }
  }

  private async emitProgress(event: ArxivProgressEvent) {
    await this.options.onProgress?.(event);
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(status: number) {
  return status === 403 || status === 429 || status >= 500;
}

class RetryableArxivError extends Error {
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    message: string,
    options: { status?: number | null; retryAfterMs?: number | null } = {},
  ) {
    super(message);
    this.name = "RetryableArxivError";
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

class NonRetryableArxivError extends Error {}

function parseRetryAfterMs(value: string | null, nowMs: number) {
  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAtMs = Date.parse(value);
  if (Number.isNaN(retryAtMs)) {
    return null;
  }

  return Math.max(0, retryAtMs - nowMs);
}
