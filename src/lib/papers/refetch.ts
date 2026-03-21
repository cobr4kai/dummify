import path from "node:path";
import { PdfExtractionStatus } from "@prisma/client";
import { ArxivClient } from "@/lib/arxiv/client";
import { prisma } from "@/lib/db";
import { ensurePaperPdfExtraction } from "@/lib/pdf/service";
import {
  buildPaperPersistenceData,
  paperToSourceRecord,
} from "@/lib/papers/record";
import { getAppSettings } from "@/lib/settings/service";
import { toJsonInput } from "@/lib/utils/prisma";

export type RefetchPaperSourceResult =
  | {
      status:
        | "metadata-refreshed-pdf-extracted"
        | "metadata-refreshed-pdf-fallback"
        | "metadata-refreshed-no-pdf-retry-needed";
      versionChanged: boolean;
    }
  | {
      status: "paper-missing" | "arxiv-record-missing" | "arxiv-fetch-failed";
      versionChanged: false;
    };

export async function refetchPaperSource(
  paperId: string,
): Promise<RefetchPaperSourceResult> {
  const existingPaper = await prisma.paper.findUnique({
    where: { id: paperId },
  });

  if (!existingPaper) {
    return {
      status: "paper-missing",
      versionChanged: false,
    };
  }

  const settings = await getAppSettings();
  const arxivClient = new ArxivClient({
    apiMinDelayMs: settings.apiMinDelayMs,
    rssMinDelayMs: settings.rssMinDelayMs,
    retryBaseDelayMs: settings.retryBaseDelayMs,
    apiCacheTtlMinutes: settings.apiCacheTtlMinutes,
    feedCacheTtlMinutes: settings.feedCacheTtlMinutes,
    cacheRoot: path.resolve(settings.pdfCacheDir),
  });

  let refreshedPaper = null;
  try {
    refreshedPaper = await arxivClient.fetchByArxivId(existingPaper.arxivId, {
      bypassCache: true,
    });
  } catch {
    return {
      status: "arxiv-fetch-failed",
      versionChanged: false,
    };
  }

  if (!refreshedPaper) {
    return {
      status: "arxiv-record-missing",
      versionChanged: false,
    };
  }

  const currentRecord = paperToSourceRecord(existingPaper);
  const nextRecord = {
    ...refreshedPaper,
    announcementDay: currentRecord.announcementDay,
    announceType: currentRecord.announceType,
    sourceFeedCategories: currentRecord.sourceFeedCategories,
    sourceMetadata: {
      ...refreshedPaper.sourceMetadata,
      sourceType: "arxiv-admin-refetch",
    },
  };
  const versionChanged = nextRecord.versionedId !== existingPaper.versionedId;

  let updatedPaper = await prisma.paper.update({
    where: { id: paperId },
    data: buildPaperPersistenceData(nextRecord, {
      isDemoData: existingPaper.isDemoData,
      lastSeenAt: new Date(),
    }),
  });

  const currentPdfCache = await prisma.paperPdfCache.findFirst({
    where: {
      paperId,
      isCurrent: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (currentPdfCache?.extractionStatus === PdfExtractionStatus.EXTRACTED) {
    return {
      status: "metadata-refreshed-no-pdf-retry-needed",
      versionChanged,
    };
  }

  const pdfResult = await ensurePaperPdfExtraction(updatedPaper, settings.pdfCacheDir);

  if (
    pdfResult.extractionStatus === "EXTRACTED" &&
    pdfResult.sourceUrl !== updatedPaper.pdfUrl
  ) {
    updatedPaper = await prisma.paper.update({
      where: { id: paperId },
      data: {
        pdfUrl: pdfResult.sourceUrl,
        links: toJsonInput({
          ...nextRecord.links,
          pdf: pdfResult.sourceUrl,
        }),
      },
    });
  }

  return {
    status:
      pdfResult.extractionStatus === "EXTRACTED"
        ? "metadata-refreshed-pdf-extracted"
        : "metadata-refreshed-pdf-fallback",
    versionChanged,
  };
}
