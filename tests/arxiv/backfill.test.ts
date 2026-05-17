import { describe, expect, it, vi } from "vitest";
import { fetchHistoricalRecordsByWindow } from "@/lib/arxiv/backfill";
import type { ArxivClient } from "@/lib/arxiv/client";
import type { PaperSourceRecord } from "@/lib/types";

describe("fetchHistoricalRecordsByWindow", () => {
  it("retries a rate-limited daily window before marking the range partial", async () => {
    const fetchHistorical = vi
      .fn<ArxivClient["fetchHistorical"]>()
      .mockResolvedValueOnce({
        records: [paperRecord("2605.00001")],
        warnings: [
          "Historical metadata request for 2026-05-11 to 2026-05-11 stopped at offset 100: arXiv returned 429.",
        ],
      })
      .mockResolvedValueOnce({
        records: [paperRecord("2605.00001"), paperRecord("2605.00002")],
        warnings: [],
      });
    const sleepFn = vi.fn(async () => {});
    const windowRecords: PaperSourceRecord[][] = [];
    const events: string[] = [];

    const result = await fetchHistoricalRecordsByWindow({
      client: { fetchHistorical } as unknown as ArxivClient,
      categories: ["cs.AI"],
      from: "2026-05-11",
      to: "2026-05-11",
      sleepFn,
      windowMaxAttempts: 2,
      windowRetryDelayMs: 10,
      onProgress: (event) => {
        events.push(event.type);
      },
      onWindowRecords: (event) => {
        windowRecords.push(event.records);
      },
    });

    expect(fetchHistorical).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      attemptedWindows: 1,
      failedWindows: 0,
      warnings: [],
    });
    expect(events).toContain("window-retry");
    expect(windowRecords.flat().map((record) => record.arxivId)).toEqual([
      "2605.00001",
      "2605.00002",
    ]);
  });

  it("keeps partial records and warning state after the window retry budget is exhausted", async () => {
    const warning =
      "Historical metadata request for 2026-05-11 to 2026-05-11 stopped at offset 100: arXiv returned 429.";
    const fetchHistorical = vi
      .fn<ArxivClient["fetchHistorical"]>()
      .mockResolvedValue({
        records: [paperRecord("2605.00001")],
        warnings: [warning],
      });
    const sleepFn = vi.fn(async () => {});
    const windowRecords: PaperSourceRecord[][] = [];

    const result = await fetchHistoricalRecordsByWindow({
      client: { fetchHistorical } as unknown as ArxivClient,
      categories: ["cs.AI"],
      from: "2026-05-11",
      to: "2026-05-11",
      sleepFn,
      windowMaxAttempts: 2,
      windowRetryDelayMs: 10,
      onWindowRecords: (event) => {
        windowRecords.push(event.records);
      },
    });

    expect(fetchHistorical).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      attemptedWindows: 1,
      failedWindows: 1,
      warnings: [warning],
    });
    expect(windowRecords[0]?.map((record) => record.arxivId)).toEqual([
      "2605.00001",
    ]);
  });
});

function paperRecord(arxivId: string): PaperSourceRecord {
  return {
    arxivId,
    version: 1,
    versionedId: `${arxivId}v1`,
    title: `Paper ${arxivId}`,
    abstract: "Abstract.",
    authors: ["A. Researcher"],
    categories: ["cs.AI"],
    sourceFeedCategories: [],
    primaryCategory: "cs.AI",
    publishedAt: new Date("2026-05-11T12:00:00.000Z"),
    updatedAt: new Date("2026-05-11T12:00:00.000Z"),
    announcementDay: "2026-05-11",
    announceType: "historical",
    comment: null,
    journalRef: null,
    doi: null,
    links: {
      abs: `https://arxiv.org/abs/${arxivId}`,
    },
    sourceMetadata: {},
    sourcePayload: {},
  };
}
