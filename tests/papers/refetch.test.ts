import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfExtractionStatus } from "@prisma/client";

const {
  ensurePaperPdfExtractionMock,
  fetchByArxivIdMock,
  findPaperMock,
  findPdfCacheMock,
  getAppSettingsMock,
  updatePaperMock,
} = vi.hoisted(() => ({
  ensurePaperPdfExtractionMock: vi.fn(),
  fetchByArxivIdMock: vi.fn(),
  findPaperMock: vi.fn(),
  findPdfCacheMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
  updatePaperMock: vi.fn(),
}));

vi.mock("@/lib/arxiv/client", () => ({
  ArxivClient: class ArxivClient {
    fetchByArxivId = fetchByArxivIdMock;
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    paper: {
      findUnique: findPaperMock,
      update: updatePaperMock,
    },
    paperPdfCache: {
      findFirst: findPdfCacheMock,
    },
  },
}));

vi.mock("@/lib/pdf/service", () => ({
  ensurePaperPdfExtraction: ensurePaperPdfExtractionMock,
}));

vi.mock("@/lib/settings/service", () => ({
  getAppSettings: getAppSettingsMock,
}));

import { refetchPaperSource } from "@/lib/papers/refetch";

describe("refetchPaperSource", () => {
  let paperRecord: Record<string, unknown>;

  beforeEach(() => {
    ensurePaperPdfExtractionMock.mockReset();
    fetchByArxivIdMock.mockReset();
    findPaperMock.mockReset();
    findPdfCacheMock.mockReset();
    getAppSettingsMock.mockReset();
    updatePaperMock.mockReset();

    getAppSettingsMock.mockResolvedValue({
      pdfCacheDir: ".paperbrief-cache",
      apiMinDelayMs: 3100,
      rssMinDelayMs: 3100,
      retryBaseDelayMs: 800,
      apiCacheTtlMinutes: 180,
      feedCacheTtlMinutes: 60,
      pdfFetchMode: "personal-research-cache",
      pdfFallbackRetryCooldownMinutes: 180,
    });
    paperRecord = {
      id: "paper-1",
      arxivId: "2603.15341",
      version: 1,
      versionedId: "2603.15341v1",
      title: "Old title",
      abstract: "Old abstract",
      authorsJson: ["Ren Jian Lim", "Rushi Dai"],
      authorsText: "Ren Jian Lim, Rushi Dai",
      categoriesJson: ["cs.AI", "cs.HC"],
      sourceFeedCategoriesJson: ["cs.AI"],
      categoryText: "cs.AI cs.HC",
      primaryCategory: "cs.AI",
      publishedAt: new Date("2026-03-16T14:28:51.000Z"),
      updatedAt: new Date("2026-03-16T14:28:51.000Z"),
      announcementDay: "2026-03-17",
      announceType: "new",
      comment: null,
      journalRef: null,
      doi: null,
      abstractUrl: "https://arxiv.org/abs/2603.15341v1",
      pdfUrl: "https://arxiv.org/pdf/2603.15341v1",
      links: {
        abs: "https://arxiv.org/abs/2603.15341v1",
        pdf: "https://arxiv.org/pdf/2603.15341v1",
      },
      sourceMetadata: { sourceType: "arxiv-rss+api" },
      sourcePayload: { old: true },
      searchText: "old title old abstract",
      isDemoData: false,
      lastSeenAt: new Date("2026-03-20T00:00:00.000Z"),
    };
    findPaperMock.mockImplementation(async () => paperRecord);
    fetchByArxivIdMock.mockResolvedValue({
      arxivId: "2603.15341",
      version: 1,
      versionedId: "2603.15341v1",
      title: "Intelligent Co-Design",
      abstract: "Fresh abstract",
      authors: ["Ren Jian Lim", "Rushi Dai"],
      categories: ["cs.AI", "cs.HC", "cs.MA"],
      sourceFeedCategories: [],
      primaryCategory: "cs.AI",
      publishedAt: new Date("2026-03-16T14:28:51.000Z"),
      updatedAt: new Date("2026-03-16T14:28:51.000Z"),
      announcementDay: "2026-03-16",
      links: {
        abs: "https://arxiv.org/abs/2603.15341v1",
        pdf: "https://arxiv.org/pdf/2603.15341v1",
      },
      sourceMetadata: { sourceType: "arxiv-api" },
      sourcePayload: { fresh: true },
    });
    updatePaperMock.mockImplementation(async ({ where, data }: Record<string, unknown>) => {
      paperRecord = {
        ...paperRecord,
        id: (where as { id: string }).id,
        ...(data as Record<string, unknown>),
      };
      return paperRecord;
    });
  });

  it("bypasses the cached arXiv response, refreshes metadata, retries fallback PDFs, and persists a repaired PDF URL", async () => {
    findPdfCacheMock.mockResolvedValue({
      id: "pdf-1",
      extractionStatus: PdfExtractionStatus.FALLBACK,
    });
    ensurePaperPdfExtractionMock.mockResolvedValue({
      sourceUrl: "https://arxiv.org/pdf/2603.15341",
      filePath: ".paperbrief-cache/2603.15341/2603.15341v1.pdf",
      extractedJsonPath: ".paperbrief-cache/2603.15341/2603.15341v1.pages.json",
      pageCount: 25,
      fileSizeBytes: 123,
      pages: [{ pageNumber: 1, text: "Page text" }],
      usedFallbackAbstract: false,
      extractionStatus: "EXTRACTED",
    });

    const result = await refetchPaperSource("paper-1");

    expect(fetchByArxivIdMock).toHaveBeenCalledWith("2603.15341", {
      bypassCache: true,
    });
    expect(ensurePaperPdfExtractionMock).toHaveBeenCalledTimes(1);
    expect(ensurePaperPdfExtractionMock).toHaveBeenCalledWith(
      expect.anything(),
      ".paperbrief-cache",
      expect.objectContaining({
        fallbackRetryCooldownMinutes: 180,
        fetchMode: "personal-research-cache",
        forceRetry: undefined,
      }),
    );
    expect(updatePaperMock).toHaveBeenCalledTimes(2);
    expect(updatePaperMock.mock.calls[1]?.[0]).toMatchObject({
      data: {
        pdfUrl: "https://arxiv.org/pdf/2603.15341",
        links: {
          abs: "https://arxiv.org/abs/2603.15341v1",
          pdf: "https://arxiv.org/pdf/2603.15341",
        },
      },
    });
    expect(result).toEqual({
      status: "metadata-refreshed-pdf-extracted",
      versionChanged: false,
    });
  });

  it("refreshes metadata without retrying when the current PDF cache is already extracted", async () => {
    findPdfCacheMock.mockResolvedValue({
      id: "pdf-1",
      extractionStatus: PdfExtractionStatus.EXTRACTED,
    });

    const result = await refetchPaperSource("paper-1");

    expect(ensurePaperPdfExtractionMock).not.toHaveBeenCalled();
    expect(updatePaperMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "metadata-refreshed-no-pdf-retry-needed",
      versionChanged: false,
    });
  });

  it("passes the admin force retry flag through to PDF extraction", async () => {
    findPdfCacheMock.mockResolvedValue({
      id: "pdf-1",
      extractionStatus: PdfExtractionStatus.FALLBACK,
    });
    ensurePaperPdfExtractionMock.mockResolvedValue({
      sourceUrl: "https://arxiv.org/pdf/2603.15341",
      filePath: ".paperbrief-cache/2603.15341/2603.15341v1.pdf",
      extractedJsonPath: ".paperbrief-cache/2603.15341/2603.15341v1.pages.json",
      pageCount: 25,
      fileSizeBytes: 123,
      pages: [{ pageNumber: 1, text: "Page text" }],
      usedFallbackAbstract: false,
      extractionStatus: "EXTRACTED",
    });

    await refetchPaperSource("paper-1", { forcePdfRetry: true });

    expect(ensurePaperPdfExtractionMock).toHaveBeenCalledWith(
      expect.anything(),
      ".paperbrief-cache",
      expect.objectContaining({
        forceRetry: true,
      }),
    );
  });

  it("returns arxiv-record-missing without mutating the paper when arXiv has no record", async () => {
    fetchByArxivIdMock.mockResolvedValue(null);

    const result = await refetchPaperSource("paper-1");

    expect(updatePaperMock).not.toHaveBeenCalled();
    expect(ensurePaperPdfExtractionMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "arxiv-record-missing",
      versionChanged: false,
    });
  });

  it("reports client fetch failures without changing the paper", async () => {
    fetchByArxivIdMock.mockRejectedValue(new Error("network"));

    const result = await refetchPaperSource("paper-1");

    expect(updatePaperMock).not.toHaveBeenCalled();
    expect(ensurePaperPdfExtractionMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "arxiv-fetch-failed",
      versionChanged: false,
    });
  });
});
