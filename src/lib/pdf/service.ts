import path from "node:path";
import { promises as fs } from "node:fs";
import { PdfExtractionStatus, type Paper, type PaperPdfCache } from "@prisma/client";
import {
  DEFAULT_PDF_FALLBACK_RETRY_COOLDOWN_MINUTES,
  DEFAULT_PDF_FETCH_MODE,
} from "@/config/defaults";
import { prisma } from "@/lib/db";
import type { PdfExtractionResult, PdfPageText } from "@/lib/types";
import { normalizeWhitespace } from "@/lib/utils/strings";

const PDF_CHUNK_MAX_CHARS = 18000;
const pdfjsGlobal = globalThis as typeof globalThis & {
  pdfjsWorker?: {
    WorkerMessageHandler: typeof import("pdfjs-dist/legacy/build/pdf.worker.mjs").WorkerMessageHandler;
  };
  pdfjsRuntime?: {
    getDocument: typeof import("pdfjs-dist/legacy/build/pdf.mjs").getDocument;
    WorkerMessageHandler: typeof import("pdfjs-dist/legacy/build/pdf.worker.mjs").WorkerMessageHandler;
  };
};

export async function ensurePaperPdfExtraction(
  paper: Pick<Paper, "id" | "arxivId" | "version" | "pdfUrl" | "abstract">,
  cacheRoot: string,
  options: {
    fallbackRetryCooldownMinutes?: number;
    fetchMode?: "personal-research-cache" | "disabled";
    forceRetry?: boolean;
  } = {},
): Promise<PdfExtractionResult> {
  const fallbackRetryCooldownMinutes =
    options.fallbackRetryCooldownMinutes ??
    DEFAULT_PDF_FALLBACK_RETRY_COOLDOWN_MINUTES;
  const fetchMode = options.fetchMode ?? DEFAULT_PDF_FETCH_MODE;
  const sourceUrl = resolveArxivPdfUrl(paper.pdfUrl, paper.arxivId, paper.version);
  const cachePaths = buildPaperCachePaths(cacheRoot, paper.arxivId, paper.version);
  const existing = await prisma.paperPdfCache.findFirst({
    where: {
      paperId: paper.id,
      isCurrent: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing?.extractedJsonPath) {
    const resolvedJsonPath = path.resolve(existing.extractedJsonPath);
    if (await fileExists(resolvedJsonPath)) {
      const cachedPages = JSON.parse(
        await fs.readFile(resolvedJsonPath, "utf8"),
      ) as PdfPageText[];

      return {
        sourceUrl: existing.sourceUrl,
        filePath: existing.filePath,
        extractedJsonPath: existing.extractedJsonPath,
        pageCount: existing.pageCount ?? cachedPages.length,
        fileSizeBytes: existing.fileSizeBytes,
        pages: cachedPages,
        usedFallbackAbstract: existing.usedFallbackAbstract,
        extractionStatus:
          existing.extractionStatus === PdfExtractionStatus.EXTRACTED
            ? "EXTRACTED"
            : existing.extractionStatus === PdfExtractionStatus.FALLBACK
              ? "FALLBACK"
              : "FAILED",
        extractionError: existing.extractionError ?? undefined,
      };
    }
  }

  if (
    existing &&
    !options.forceRetry &&
    shouldReuseFallbackResult(existing, fallbackRetryCooldownMinutes)
  ) {
    return toCachedPdfResult(existing, sourceUrl);
  }

  if (fetchMode === "disabled") {
    const fallbackResult = {
      sourceUrl,
      filePath: null,
      extractedJsonPath: null,
      pageCount: 0,
      fileSizeBytes: null,
      pages: [],
      usedFallbackAbstract: true,
      extractionStatus: "FALLBACK" as const,
      extractionError: "PDF fetching is disabled by policy.",
    };

    await upsertPdfCacheRecord(existing?.id, {
      paperId: paper.id,
      sourceUrl,
      filePath: null,
      extractedJsonPath: null,
      fileSizeBytes: null,
      pageCount: 0,
      extractionStatus: PdfExtractionStatus.FALLBACK,
      extractionError: fallbackResult.extractionError,
      usedFallbackAbstract: true,
      fetchedAt: new Date(),
      extractedAt: new Date(),
    });

    return fallbackResult;
  }

  await fs.mkdir(path.dirname(cachePaths.pdfPath), { recursive: true });

  try {
    const resolvedFetch = await fetchArxivPdfBuffer({
      pdfUrl: paper.pdfUrl,
      arxivId: paper.arxivId,
      version: paper.version,
    });
    const pdfBuffer = Buffer.from(resolvedFetch.arrayBuffer);
    const finalSourceUrl = resolvedFetch.responseUrl || resolvedFetch.sourceUrl;
    await fs.writeFile(cachePaths.pdfPath, pdfBuffer);

    const pages = await extractPdfPages(pdfBuffer);
    await fs.writeFile(cachePaths.pagesPath, JSON.stringify(pages, null, 2), "utf8");

    await upsertPdfCacheRecord(existing?.id, {
      paperId: paper.id,
      sourceUrl: finalSourceUrl,
      filePath: cachePaths.pdfPath,
      extractedJsonPath: cachePaths.pagesPath,
      fileSizeBytes: pdfBuffer.byteLength,
      pageCount: pages.length,
      extractionStatus: PdfExtractionStatus.EXTRACTED,
      extractionError: null,
      usedFallbackAbstract: false,
      fetchedAt: new Date(),
      extractedAt: new Date(),
    });

    return {
      sourceUrl: finalSourceUrl,
      filePath: cachePaths.pdfPath,
      extractedJsonPath: cachePaths.pagesPath,
      pageCount: pages.length,
      fileSizeBytes: pdfBuffer.byteLength,
      pages,
      usedFallbackAbstract: false,
      extractionStatus: "EXTRACTED",
    };
  } catch (error) {
    await upsertPdfCacheRecord(existing?.id, {
      paperId: paper.id,
      sourceUrl,
      filePath: null,
      extractedJsonPath: null,
      fileSizeBytes: null,
      pageCount: 0,
      extractionStatus: PdfExtractionStatus.FALLBACK,
      extractionError: error instanceof Error ? error.message : "Unknown PDF extraction error.",
      usedFallbackAbstract: true,
      fetchedAt: new Date(),
      extractedAt: new Date(),
    });

    return {
      sourceUrl,
      filePath: null,
      extractedJsonPath: null,
      pageCount: 0,
      fileSizeBytes: null,
      pages: [],
      usedFallbackAbstract: true,
      extractionStatus: "FALLBACK",
      extractionError: error instanceof Error ? error.message : "Unknown PDF extraction error.",
    };
  }
}

export function chunkPdfPages(pages: PdfPageText[], maxChars = PDF_CHUNK_MAX_CHARS) {
  const chunks: PdfPageText[][] = [];
  let currentChunk: PdfPageText[] = [];
  let currentCharCount = 0;

  for (const page of pages) {
    const pageLength = page.text.length;
    if (
      currentChunk.length > 0 &&
      currentCharCount + pageLength > maxChars
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentCharCount = 0;
    }

    currentChunk.push(page);
    currentCharCount += pageLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function fetchArxivPdfBuffer(input: {
  pdfUrl: string | null;
  arxivId: string;
  version: number;
}) {
  const candidates = buildArxivPdfCandidateUrls(
    input.pdfUrl,
    input.arxivId,
    input.version,
  );
  let lastNotFound: Error | null = null;

  for (const candidate of candidates) {
    const response = await fetch(candidate, {
      headers: {
        "User-Agent": "PaperBrief/0.2",
      },
      next: { revalidate: 0 },
    });

    if (response.ok) {
      return {
        sourceUrl: candidate,
        responseUrl: response.url,
        arrayBuffer: await response.arrayBuffer(),
      };
    }

    if (response.status === 404) {
      lastNotFound = new Error(`arXiv PDF request failed with ${response.status}.`);
      continue;
    }

    throw new Error(`arXiv PDF request failed with ${response.status}.`);
  }

  throw lastNotFound ?? new Error("Unknown PDF extraction error.");
}

async function extractPdfPages(pdfBuffer: Buffer): Promise<PdfPageText[]> {
  const { getDocument } = await loadPdfJsRuntime();
  const document = await getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;

  const pages: PdfPageText[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = normalizeWhitespace(
      textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" "),
    );

    pages.push({
      pageNumber,
      text: pageText,
    });
  }

  return pages.filter((page) => page.text.length > 0);
}

function buildPaperCachePaths(cacheRoot: string, arxivId: string, version: number) {
  const safeId = arxivId.replace(/[^\w.-]+/g, "_");
  const paperDirectory = path.resolve(cacheRoot, safeId);

  return {
    pdfPath: path.join(paperDirectory, `${safeId}v${version}.pdf`),
    pagesPath: path.join(paperDirectory, `${safeId}v${version}.pages.json`),
  };
}

function resolveArxivPdfUrl(pdfUrl: string | null, arxivId: string, version: number) {
  if (pdfUrl?.startsWith("https://arxiv.org/pdf/")) {
    return pdfUrl;
  }

  return `https://arxiv.org/pdf/${arxivId}v${version}.pdf`;
}

function shouldReuseFallbackResult(
  existing: Pick<
    PaperPdfCache,
    "extractionStatus" | "fetchedAt" | "extractedAt" | "updatedAt"
  >,
  cooldownMinutes: number,
) {
  if (
    existing.extractionStatus !== PdfExtractionStatus.FALLBACK &&
    existing.extractionStatus !== PdfExtractionStatus.FAILED
  ) {
    return false;
  }

  if (cooldownMinutes <= 0) {
    return false;
  }

  const lastAttemptAt =
    existing.extractedAt ?? existing.fetchedAt ?? existing.updatedAt ?? null;
  if (!lastAttemptAt) {
    return false;
  }

  return Date.now() - lastAttemptAt.getTime() < cooldownMinutes * 60 * 1000;
}

function toCachedPdfResult(
  existing: Pick<
    PaperPdfCache,
    | "sourceUrl"
    | "filePath"
    | "extractedJsonPath"
    | "pageCount"
    | "fileSizeBytes"
    | "usedFallbackAbstract"
    | "extractionStatus"
    | "extractionError"
  >,
  fallbackSourceUrl: string,
): PdfExtractionResult {
  return {
    sourceUrl: existing.sourceUrl || fallbackSourceUrl,
    filePath: existing.filePath,
    extractedJsonPath: existing.extractedJsonPath,
    pageCount: existing.pageCount ?? 0,
    fileSizeBytes: existing.fileSizeBytes ?? null,
    pages: [],
    usedFallbackAbstract: existing.usedFallbackAbstract,
    extractionStatus:
      existing.extractionStatus === PdfExtractionStatus.EXTRACTED
        ? "EXTRACTED"
        : existing.extractionStatus === PdfExtractionStatus.FALLBACK
          ? "FALLBACK"
          : "FAILED",
    extractionError: existing.extractionError ?? undefined,
  };
}

function buildArxivPdfCandidateUrls(
  pdfUrl: string | null,
  arxivId: string,
  version: number,
) {
  const candidates = new Set<string>();

  if (pdfUrl?.startsWith("https://arxiv.org/pdf/")) {
    candidates.add(pdfUrl);
    candidates.add(pdfUrl.replace(/\.pdf$/i, ""));
    candidates.add(pdfUrl.endsWith(".pdf") ? pdfUrl : `${pdfUrl}.pdf`);
  }

  candidates.add(`https://arxiv.org/pdf/${arxivId}v${version}`);
  candidates.add(`https://arxiv.org/pdf/${arxivId}v${version}.pdf`);
  candidates.add(`https://arxiv.org/pdf/${arxivId}`);
  candidates.add(`https://arxiv.org/pdf/${arxivId}.pdf`);

  return Array.from(candidates);
}

async function upsertPdfCacheRecord(
  existingId: string | undefined,
  data: {
    paperId: string;
    sourceUrl: string;
    filePath: string | null;
    extractedJsonPath: string | null;
    fileSizeBytes: number | null;
    pageCount: number;
    extractionStatus: PdfExtractionStatus;
    extractionError: string | null;
    usedFallbackAbstract: boolean;
    fetchedAt: Date;
    extractedAt: Date;
  },
) {
  if (existingId) {
    return prisma.paperPdfCache.update({
      where: { id: existingId },
      data,
    });
  }

  return prisma.paperPdfCache.create({
    data,
  });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadPdfJsRuntime() {
  if (!pdfjsGlobal.pdfjsRuntime) {
    const [{ getDocument }, { WorkerMessageHandler }] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
    ]);

    pdfjsGlobal.pdfjsWorker = { WorkerMessageHandler };
    pdfjsGlobal.pdfjsRuntime = {
      getDocument,
      WorkerMessageHandler,
    };
  }

  return pdfjsGlobal.pdfjsRuntime;
}
