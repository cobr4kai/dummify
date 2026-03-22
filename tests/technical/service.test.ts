import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMock,
  ensurePaperPdfExtractionMock,
  findPaperMock,
  findTechnicalBriefMock,
  generateMock,
  getAppSettingsMock,
  getTechnicalBriefProviderMock,
  updateManyMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  ensurePaperPdfExtractionMock: vi.fn(),
  findPaperMock: vi.fn(),
  findTechnicalBriefMock: vi.fn(),
  generateMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
  getTechnicalBriefProviderMock: vi.fn(),
  updateManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    paper: {
      findUnique: findPaperMock,
    },
    paperTechnicalBrief: {
      findFirst: findTechnicalBriefMock,
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        paperTechnicalBrief: {
          updateMany: updateManyMock,
          create: createMock,
        },
      }),
    ),
  },
}));

vi.mock("@/lib/pdf/service", () => ({
  ensurePaperPdfExtraction: ensurePaperPdfExtractionMock,
}));

vi.mock("@/lib/papers/record", () => ({
  paperToSourceRecord: (paper: unknown) => paper,
}));

vi.mock("@/lib/providers", () => ({
  getTechnicalBriefProvider: getTechnicalBriefProviderMock,
}));

vi.mock("@/lib/settings/service", () => ({
  getAppSettings: getAppSettingsMock,
}));

import { ensurePaperTechnicalBrief } from "@/lib/technical/service";

describe("ensurePaperTechnicalBrief", () => {
  beforeEach(() => {
    createMock.mockReset();
    ensurePaperPdfExtractionMock.mockReset();
    findPaperMock.mockReset();
    findTechnicalBriefMock.mockReset();
    generateMock.mockReset();
    getAppSettingsMock.mockReset();
    getTechnicalBriefProviderMock.mockReset();
    updateManyMock.mockReset();

    findTechnicalBriefMock.mockResolvedValue({
      id: "brief-1",
      usedFallbackAbstract: true,
    });
    findPaperMock.mockResolvedValue({
      id: "paper-1",
      arxivId: "2603.12345",
      version: 1,
      pdfUrl: "https://arxiv.org/pdf/2603.12345v1.pdf",
      abstract: "Test abstract",
      title: "Test paper",
      authorsJson: [],
      authorsText: "Author",
      categoriesJson: [],
      sourceFeedCategoriesJson: [],
      categoryText: "cs.AI",
      primaryCategory: "cs.AI",
      publishedAt: new Date("2026-03-12T00:00:00.000Z"),
      updatedAt: new Date("2026-03-12T00:00:00.000Z"),
      announcementDay: "2026-03-12",
      announceType: null,
      comment: null,
      journalRef: null,
      doi: null,
      abstractUrl: "https://arxiv.org/abs/2603.12345",
      links: {},
      sourceMetadata: {},
      sourcePayload: {},
      searchText: "test",
      lastSeenAt: new Date("2026-03-12T00:00:00.000Z"),
      isDemoData: false,
      versionedId: "2603.12345v1",
    });
    ensurePaperPdfExtractionMock.mockResolvedValue({
      pages: [],
      usedFallbackAbstract: true,
      extractionStatus: "FALLBACK",
      extractionError: "Timed out",
      sourceUrl: "https://arxiv.org/pdf/2603.12345v1.pdf",
      filePath: null,
      extractedJsonPath: null,
      pageCount: 0,
      fileSizeBytes: null,
    });
    getAppSettingsMock.mockResolvedValue({
      pdfCacheDir: ".paperbrief-cache",
      genAiUsePremiumSynthesis: false,
      pdfFetchMode: "personal-research-cache",
      pdfFallbackRetryCooldownMinutes: 180,
    });
    getTechnicalBriefProviderMock.mockReturnValue({
      provider: "openai",
      resolveModel: () => "gpt-test",
      generate: generateMock,
    });
  });

  it("refuses to create a homepage brief when PDF extraction falls back to the abstract", async () => {
    await expect(
      ensurePaperTechnicalBrief("paper-1", { requirePdf: true }),
    ).resolves.toBe("pdf-required");

    expect(generateMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});
