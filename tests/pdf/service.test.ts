import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createPdfCacheMock,
  findPdfCacheMock,
  getDocumentMock,
  updatePdfCacheMock,
} = vi.hoisted(() => ({
  createPdfCacheMock: vi.fn(),
  findPdfCacheMock: vi.fn(),
  getDocumentMock: vi.fn(),
  updatePdfCacheMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    paperPdfCache: {
      create: createPdfCacheMock,
      findFirst: findPdfCacheMock,
      update: updatePdfCacheMock,
    },
  },
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: getDocumentMock,
}));

vi.mock("pdfjs-dist/legacy/build/pdf.worker.mjs", () => ({
  WorkerMessageHandler: {},
}));

import { ensurePaperPdfExtraction } from "@/lib/pdf/service";

const cacheRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cacheRoots.splice(0).map((cacheRoot) =>
      rm(cacheRoot, { recursive: true, force: true }),
    ),
  );
});

describe("ensurePaperPdfExtraction", () => {
  beforeEach(() => {
    createPdfCacheMock.mockReset();
    findPdfCacheMock.mockReset();
    getDocumentMock.mockReset();
    updatePdfCacheMock.mockReset();
    delete (globalThis as Record<string, unknown>).pdfjsRuntime;
    delete (globalThis as Record<string, unknown>).pdfjsWorker;

    findPdfCacheMock.mockResolvedValue({
      id: "pdf-cache-1",
      extractedJsonPath: null,
    });
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        cleanup: vi.fn(),
        getPage: async () => ({
          cleanup: vi.fn(),
          getTextContent: async () => ({
            items: [{ str: "Recovered PDF page text" }],
          }),
        }),
      }),
      destroy: vi.fn(),
    });
  });

  it("falls back from versioned arXiv PDF URLs to the working unversioned URL", async () => {
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "paperbrief-pdf-"));
    cacheRoots.push(cacheRoot);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
          },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await ensurePaperPdfExtraction(
      {
        id: "paper-1",
        arxivId: "2603.15341",
        version: 1,
        pdfUrl: "https://arxiv.org/pdf/2603.15341v1",
        abstract: "Test abstract",
      },
      cacheRoot,
    );

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://arxiv.org/pdf/2603.15341v1",
      "https://arxiv.org/pdf/2603.15341v1.pdf",
      "https://arxiv.org/pdf/2603.15341",
    ]);
    expect(result).toMatchObject({
      sourceUrl: "https://arxiv.org/pdf/2603.15341",
      extractionStatus: "EXTRACTED",
      usedFallbackAbstract: false,
      pageCount: 1,
    });
    expect(updatePdfCacheMock).toHaveBeenCalledWith({
      where: { id: "pdf-cache-1" },
      data: expect.objectContaining({
        sourceUrl: "https://arxiv.org/pdf/2603.15341",
        extractionStatus: "EXTRACTED",
      }),
    });

    const extractedJsonPath = updatePdfCacheMock.mock.calls[0]?.[0]?.data?.extractedJsonPath;
    expect(typeof extractedJsonPath).toBe("string");
    const pages = JSON.parse(await readFile(extractedJsonPath, "utf8")) as Array<{
      text: string;
    }>;
    expect(pages[0]?.text).toBe("Recovered PDF page text");
  });

  it("reuses a recent fallback result instead of re-fetching the same missing PDF", async () => {
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "paperbrief-pdf-"));
    cacheRoots.push(cacheRoot);
    const fetchMock = vi.fn<typeof fetch>();

    findPdfCacheMock.mockResolvedValue({
      id: "pdf-cache-1",
      sourceUrl: "https://arxiv.org/pdf/2603.15341v1",
      filePath: null,
      extractedJsonPath: null,
      pageCount: 0,
      fileSizeBytes: null,
      usedFallbackAbstract: true,
      extractionStatus: "FALLBACK",
      extractionError: "arXiv PDF request failed with 404.",
      fetchedAt: new Date(),
      extractedAt: new Date(),
      updatedAt: new Date(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensurePaperPdfExtraction(
      {
        id: "paper-1",
        arxivId: "2603.15341",
        version: 1,
        pdfUrl: "https://arxiv.org/pdf/2603.15341v1",
        abstract: "Test abstract",
      },
      cacheRoot,
      {
        fallbackRetryCooldownMinutes: 180,
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(updatePdfCacheMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      sourceUrl: "https://arxiv.org/pdf/2603.15341v1",
      extractionStatus: "FALLBACK",
      usedFallbackAbstract: true,
      extractionError: "arXiv PDF request failed with 404.",
    });
  });

  it("falls back instead of parsing PDFs that exceed the web memory guard", async () => {
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "paperbrief-pdf-"));
    cacheRoots.push(cacheRoot);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("too large", {
        status: 200,
        headers: {
          "Content-Length": String(9 * 1024 * 1024),
          "Content-Type": "application/pdf",
        },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await ensurePaperPdfExtraction(
      {
        id: "paper-1",
        arxivId: "2603.15341",
        version: 1,
        pdfUrl: "https://arxiv.org/pdf/2603.15341v1",
        abstract: "Test abstract",
      },
      cacheRoot,
      {
        forceRetry: true,
      },
    );

    expect(getDocumentMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      extractionStatus: "FALLBACK",
      usedFallbackAbstract: true,
      extractionError: expect.stringContaining("too large to fetch safely"),
    });
    expect(updatePdfCacheMock).toHaveBeenCalledWith({
      where: { id: "pdf-cache-1" },
      data: expect.objectContaining({
        extractionStatus: "FALLBACK",
        extractionError: expect.stringContaining("too large to fetch safely"),
        usedFallbackAbstract: true,
      }),
    });
  });
});
