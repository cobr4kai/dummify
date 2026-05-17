import { ArxivClient, type HistoricalFetchResult } from "@/lib/arxiv/client";
import type { PaperSourceRecord } from "@/lib/types";
import { addDays } from "@/lib/utils/dates";

export type ArxivBackfillProvider = {
  provider: "oai-pmh";
  fetchRange(input: {
    categories: string[];
    from: string;
    to: string;
  }): Promise<PaperSourceRecord[]>;
};

export type HistoricalRecordsResult = {
  records: PaperSourceRecord[];
  warnings: string[];
  attemptedWindows: number;
  failedWindows: number;
};

export type HistoricalBackfillProgressEvent =
  | {
      type: "window-start";
      index: number;
      totalWindows: number;
      from: string;
      to: string;
      attempt?: number;
      maxAttempts?: number;
    }
  | {
      type: "window-retry";
      index: number;
      totalWindows: number;
      from: string;
      to: string;
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      warnings: string[];
    }
  | {
      type: "window-complete";
      index: number;
      totalWindows: number;
      from: string;
      to: string;
      fetchedCount: number;
    }
  | {
      type: "window-warning";
      index: number;
      totalWindows: number;
      from: string;
      to: string;
      warnings: string[];
    };

export type HistoricalBackfillWindowRecordsEvent = {
  index: number;
  totalWindows: number;
  from: string;
  to: string;
  records: PaperSourceRecord[];
};

const DEFAULT_HISTORICAL_WINDOW_MAX_ATTEMPTS = 3;
const DEFAULT_HISTORICAL_WINDOW_RETRY_DELAY_MS = 5 * 60 * 1000;

export async function fetchHistoricalRecords(input: {
  client: ArxivClient;
  categories: string[];
  from: string;
  to: string;
  provider?: ArxivBackfillProvider | null;
  onProgress?: (event: HistoricalBackfillProgressEvent) => Promise<void> | void;
}): Promise<HistoricalRecordsResult> {
  const records: PaperSourceRecord[] = [];
  const result = await fetchHistoricalRecordsByWindow({
    ...input,
    onWindowRecords: async (event) => {
      records.push(...event.records);
    },
  });

  return {
    ...result,
    records,
  };
}

export async function fetchHistoricalRecordsByWindow(input: {
  client: ArxivClient;
  categories: string[];
  from: string;
  to: string;
  provider?: ArxivBackfillProvider | null;
  onProgress?: (event: HistoricalBackfillProgressEvent) => Promise<void> | void;
  onWindowRecords?: (event: HistoricalBackfillWindowRecordsEvent) => Promise<void> | void;
  windowMaxAttempts?: number;
  windowRetryDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}): Promise<Omit<HistoricalRecordsResult, "records">> {
  if (input.provider) {
    const records = await input.provider.fetchRange({
      categories: input.categories,
      from: input.from,
      to: input.to,
    });
    await input.onWindowRecords?.({
      index: 1,
      totalWindows: 1,
      from: input.from,
      to: input.to,
      records,
    });

    return {
      warnings: [],
      attemptedWindows: 1,
      failedWindows: 0,
    };
  }

  const seenIds = new Set<string>();
  const warnings: string[] = [];
  const windows = buildDailyWindows(input.from, input.to);
  let failedWindows = 0;
  const windowMaxAttempts = readPositiveInteger(
    process.env.PAPERBRIEF_HISTORICAL_WINDOW_MAX_ATTEMPTS,
    input.windowMaxAttempts ?? DEFAULT_HISTORICAL_WINDOW_MAX_ATTEMPTS,
  );
  const windowRetryDelayMs = readPositiveInteger(
    process.env.PAPERBRIEF_HISTORICAL_WINDOW_RETRY_DELAY_MS,
    input.windowRetryDelayMs ?? DEFAULT_HISTORICAL_WINDOW_RETRY_DELAY_MS,
  );
  const sleepFn = input.sleepFn ?? sleep;

  for (const [index, window] of windows.entries()) {
    const windowSeenIds = new Set<string>();
    let fetchedInWindow = 0;
    let result: HistoricalFetchResult = {
      records: [],
      warnings: [],
    };

    for (let attempt = 1; attempt <= windowMaxAttempts; attempt += 1) {
      await input.onProgress?.({
        type: "window-start",
        index: index + 1,
        totalWindows: windows.length,
        from: window.from,
        to: window.to,
        attempt,
        maxAttempts: windowMaxAttempts,
      });
      result = await input.client.fetchHistorical(input.categories, window.from, window.to, {
        onRecords: async (records) => {
          const uniqueRecords = filterUniqueWindowRecords({
            records,
            seenIds,
            windowSeenIds,
          });

          if (uniqueRecords.length === 0) {
            return;
          }

          fetchedInWindow += uniqueRecords.length;
          await input.onWindowRecords?.({
            index: index + 1,
            totalWindows: windows.length,
            from: window.from,
            to: window.to,
            records: uniqueRecords,
          });
        },
      });

      if (result.records.length > 0) {
        const uniqueRecords = filterUniqueWindowRecords({
          records: result.records,
          seenIds,
          windowSeenIds,
        });

        if (uniqueRecords.length > 0) {
          fetchedInWindow += uniqueRecords.length;
          await input.onWindowRecords?.({
            index: index + 1,
            totalWindows: windows.length,
            from: window.from,
            to: window.to,
            records: uniqueRecords,
          });
        }
      }

      if (result.warnings.length === 0 || attempt === windowMaxAttempts) {
        break;
      }

      await input.onProgress?.({
        type: "window-retry",
        index: index + 1,
        totalWindows: windows.length,
        from: window.from,
        to: window.to,
        attempt,
        maxAttempts: windowMaxAttempts,
        delayMs: windowRetryDelayMs,
        warnings: result.warnings,
      });
      await sleepFn(windowRetryDelayMs);
    }

    if (result.warnings.length > 0) {
      failedWindows += 1;
      warnings.push(...result.warnings);
      await input.onProgress?.({
        type: "window-warning",
        index: index + 1,
        totalWindows: windows.length,
        from: window.from,
        to: window.to,
        warnings: result.warnings,
      });
    }

    await input.onProgress?.({
      type: "window-complete",
      index: index + 1,
      totalWindows: windows.length,
      from: window.from,
      to: window.to,
      fetchedCount: fetchedInWindow,
    });
  }

  return {
    warnings,
    attemptedWindows: windows.length,
    failedWindows,
  };
}

function buildDailyWindows(from: string, to: string) {
  const windows: Array<{ from: string; to: string }> = [];
  let cursor = from;

  while (cursor <= to) {
    windows.push({ from: cursor, to: cursor });
    cursor = addDays(cursor, 1);
  }

  return windows;
}

function filterUniqueWindowRecords(input: {
  records: PaperSourceRecord[];
  seenIds: Set<string>;
  windowSeenIds: Set<string>;
}) {
  const uniqueRecords: PaperSourceRecord[] = [];

  for (const record of input.records) {
    if (input.windowSeenIds.has(record.arxivId) || input.seenIds.has(record.arxivId)) {
      continue;
    }

    input.windowSeenIds.add(record.arxivId);
    input.seenIds.add(record.arxivId);
    uniqueRecords.push(record);
  }

  return uniqueRecords;
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
