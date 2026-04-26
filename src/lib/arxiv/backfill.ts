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

  for (const [index, window] of windows.entries()) {
    await input.onProgress?.({
      type: "window-start",
      index: index + 1,
      totalWindows: windows.length,
      from: window.from,
      to: window.to,
    });
    const result: HistoricalFetchResult = await input.client.fetchHistorical(
      input.categories,
      window.from,
      window.to,
    );

    const uniqueRecords = result.records.filter((record) => {
      if (seenIds.has(record.arxivId)) {
        return false;
      }
      seenIds.add(record.arxivId);
      return true;
    });

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

    await input.onWindowRecords?.({
      index: index + 1,
      totalWindows: windows.length,
      from: window.from,
      to: window.to,
      records: uniqueRecords,
    });

    await input.onProgress?.({
      type: "window-complete",
      index: index + 1,
      totalWindows: windows.length,
      from: window.from,
      to: window.to,
      fetchedCount: uniqueRecords.length,
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
