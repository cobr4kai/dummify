import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refetchPaperSource } from "@/lib/papers/refetch";
import { getPublishedPaperIdsForWeek } from "@/lib/publishing/service";
import { hasPdfBackedBrief } from "@/lib/technical/brief-status";
import { ensurePaperTechnicalBrief } from "@/lib/technical/service";
import { formatWeekLabel } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EditionPaper = Awaited<ReturnType<typeof loadEditionPapers>>[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = request.nextUrl.searchParams.get("week");
  if (!weekStart || !DATE_PATTERN.test(weekStart)) {
    return NextResponse.json(
      { error: "A week query parameter in YYYY-MM-DD format is required." },
      { status: 400 },
    );
  }

  const action = request.nextUrl.searchParams.get("action") ?? "status";
  const forceFetch = request.nextUrl.searchParams.get("forceFetch") === "1";
  const papers = await loadEditionPapers(weekStart);

  if (action === "status") {
    return NextResponse.json(await buildStatusPayload(weekStart, papers));
  }

  if (action !== "process-next") {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const nextPaper = papers.find((paper) => !hasPdfBackedBrief(paper.technicalBriefs));
  if (!nextPaper) {
    return NextResponse.json({
      ...(await buildStatusPayload(weekStart, papers)),
      processed: null,
      status: "ready",
    });
  }

  const processed = await fillPdfBriefForPaper(nextPaper, { forceFetch });
  const refreshedPapers = await loadEditionPapers(weekStart);

  return NextResponse.json({
    ...(await buildStatusPayload(weekStart, refreshedPapers)),
    processed,
    status: processed.result === "generated" ? "processed" : processed.result,
  });
}

async function loadEditionPapers(weekStart: string) {
  const paperIds = await getPublishedPaperIdsForWeek(weekStart);
  if (paperIds.length === 0) {
    return [];
  }

  const papers = await prisma.paper.findMany({
    where: { id: { in: paperIds } },
    include: {
      technicalBriefs: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      pdfCaches: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });
  const paperById = new Map(papers.map((paper) => [paper.id, paper]));

  return paperIds
    .map((paperId) => paperById.get(paperId))
    .filter((paper): paper is NonNullable<typeof paper> => Boolean(paper));
}

async function buildStatusPayload(weekStart: string, papers: EditionPaper[]) {
  const items = papers.map((paper, index) => {
    const currentBrief = paper.technicalBriefs[0] ?? null;
    const currentPdfCache = paper.pdfCaches[0] ?? null;

    return {
      slot: index + 1,
      id: paper.id,
      title: paper.title,
      arxivId: `${paper.arxivId}v${paper.version}`,
      detailPath: `/papers/${paper.id}`,
      pdfBriefReady: hasPdfBackedBrief(paper.technicalBriefs),
      currentBriefBasis: currentBrief
        ? currentBrief.usedFallbackAbstract
          ? "abstract-fallback"
          : "full-pdf"
        : "missing",
      pdfExtractionStatus: currentPdfCache?.extractionStatus ?? "missing",
      pdfTextCached: Boolean(currentPdfCache?.extractedJsonPath),
    };
  });
  const readyCount = items.filter((item) => item.pdfBriefReady).length;

  return {
    weekStart,
    weekLabel: formatWeekLabel(weekStart),
    selectedCount: papers.length,
    pdfBriefsReady: readyCount,
    pdfBriefsMissing: papers.length - readyCount,
    items,
  };
}

async function fillPdfBriefForPaper(
  paper: EditionPaper,
  options: { forceFetch: boolean },
) {
  if (hasPdfBackedBrief(paper.technicalBriefs)) {
    return describePaperResult(paper, "existing", "Paper already has a PDF-backed brief.");
  }

  const hasExtractedPdf = paper.pdfCaches.some(
    (cache) => cache.extractionStatus === "EXTRACTED" && cache.extractedJsonPath,
  );

  let refetchStatus: string | null = null;
  if (!hasExtractedPdf || options.forceFetch) {
    const refetchResult = await refetchPaperSource(paper.id, {
      forcePdfRetry: true,
    });
    refetchStatus = refetchResult.status;

    if (!isPdfAvailableAfterRefetch(refetchResult.status)) {
      return describePaperResult(
        paper,
        "pdf-unavailable",
        "PDF text could not be extracted, so no abstract-only brief was generated.",
        refetchStatus,
      );
    }
  }

  let result = await ensurePaperTechnicalBrief(paper.id, {
    force: true,
    requirePdf: true,
    pdfFetchMode: "disabled",
  });

  if (result === "pdf-required" && hasExtractedPdf && !options.forceFetch) {
    const refetchResult = await refetchPaperSource(paper.id, {
      forcePdfRetry: true,
    });
    refetchStatus = refetchResult.status;

    if (isPdfAvailableAfterRefetch(refetchResult.status)) {
      result = await ensurePaperTechnicalBrief(paper.id, {
        force: true,
        requirePdf: true,
        pdfFetchMode: "disabled",
      });
    }
  }

  return describePaperResult(
    paper,
    result,
    result === "generated"
      ? "Generated a PDF-backed brief."
      : "PDF-backed brief generation did not complete.",
    refetchStatus,
  );
}

function isPdfAvailableAfterRefetch(status: string) {
  return (
    status === "metadata-refreshed-pdf-extracted" ||
    status === "metadata-stale-pdf-extracted" ||
    status === "metadata-refreshed-no-pdf-retry-needed"
  );
}

function describePaperResult(
  paper: EditionPaper,
  result: string,
  message: string,
  pdfFetchStatus: string | null = null,
) {
  return {
    id: paper.id,
    title: paper.title,
    arxivId: `${paper.arxivId}v${paper.version}`,
    result,
    pdfFetchStatus,
    message,
  };
}
