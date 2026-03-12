import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findCurrentEnrichmentMock,
  findPaperMock,
  getEnrichmentProviderMock,
  transactionMock,
  updateManyMock,
  createMock,
} = vi.hoisted(() => ({
  findCurrentEnrichmentMock: vi.fn(),
  findPaperMock: vi.fn(),
  getEnrichmentProviderMock: vi.fn(),
  transactionMock: vi.fn(),
  updateManyMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/providers", () => ({
  getEnrichmentProvider: getEnrichmentProviderMock,
  getTechnicalBriefProvider: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    paperEnrichment: {
      findFirst: findCurrentEnrichmentMock,
    },
    paper: {
      findUnique: findPaperMock,
    },
    $transaction: transactionMock,
  },
}));

import { ensurePaperEnrichment } from "@/lib/ingestion/service";

describe("ensurePaperEnrichment", () => {
  beforeEach(() => {
    findCurrentEnrichmentMock.mockReset();
    findPaperMock.mockReset();
    getEnrichmentProviderMock.mockReset();
    transactionMock.mockReset();
    updateManyMock.mockReset();
    createMock.mockReset();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        paperEnrichment: {
          updateMany: updateManyMock,
          create: createMock,
        },
      }),
    );
  });

  it("reuses the current enrichment by default", async () => {
    const enrichMock = vi.fn();
    getEnrichmentProviderMock.mockReturnValue({
      provider: "openalex",
      enrich: enrichMock,
    });
    findCurrentEnrichmentMock.mockResolvedValue({
      id: "enrichment-1",
    });

    const result = await ensurePaperEnrichment("paper-1");

    expect(result).toBe(false);
    expect(enrichMock).not.toHaveBeenCalled();
    expect(findPaperMock).not.toHaveBeenCalled();
  });

  it("refreshes enrichment when forced", async () => {
    const enrichMock = vi.fn().mockResolvedValue({
      provider: "openalex",
      providerRecordId: "work-1",
      payload: {
        citedByCount: 10,
      },
    });
    getEnrichmentProviderMock.mockReturnValue({
      provider: "openalex",
      enrich: enrichMock,
    });
    findCurrentEnrichmentMock.mockResolvedValue({
      id: "enrichment-1",
    });
    findPaperMock.mockResolvedValue({
      id: "paper-1",
      arxivId: "2603.08877",
      version: 1,
      versionedId: "2603.08877v1",
      title: "Demo paper",
      abstract: "Demo abstract",
      authorsJson: ["Ada Lovelace"],
      categoriesJson: ["cs.AI"],
      sourceFeedCategoriesJson: ["cs.AI"],
      primaryCategory: "cs.AI",
      publishedAt: new Date("2026-03-11T00:00:00.000Z"),
      updatedAt: new Date("2026-03-11T00:00:00.000Z"),
      announcementDay: "2026-03-11",
      announceType: "demo",
      comment: null,
      journalRef: null,
      doi: null,
      abstractUrl: "https://arxiv.org/abs/2603.08877",
      pdfUrl: null,
      sourceMetadata: { sourceType: "demo" },
      sourcePayload: { note: "fixture" },
    });
    updateManyMock.mockResolvedValue({ count: 1 });
    createMock.mockResolvedValue({ id: "enrichment-2" });

    const result = await ensurePaperEnrichment("paper-1", { force: true });

    expect(result).toBe(true);
    expect(enrichMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
