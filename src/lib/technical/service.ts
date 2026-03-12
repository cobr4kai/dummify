import { BriefMode, Prisma, type Paper } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensurePaperPdfExtraction } from "@/lib/pdf/service";
import { paperToSourceRecord } from "@/lib/papers/record";
import { getTechnicalBriefProvider } from "@/lib/providers";
import { getAppSettings } from "@/lib/settings/service";
import { toJsonInput } from "@/lib/utils/prisma";
import type { StructuredTechnicalBrief } from "@/lib/types";

export async function ensurePaperTechnicalBrief(
  paperId: string,
  options: { force?: boolean } = {},
) {
  const existing = await prisma.paperTechnicalBrief.findFirst({
    where: {
      paperId,
      isCurrent: true,
    },
  });

  if (existing && !options.force) {
    return false;
  }

  const provider = getTechnicalBriefProvider();
  if (!provider) {
    return false;
  }

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
  });

  if (!paper) {
    return false;
  }

  const settings = await getAppSettings();
  const pdfResult = await ensurePaperPdfExtraction(paper, settings.pdfCacheDir);
  const technicalBrief = await provider.generate(paperToSourceRecord(paper), {
    pages: pdfResult.pages,
    sourceBasis: pdfResult.usedFallbackAbstract ? "abstract-fallback" : "full-pdf",
    usePremiumSynthesis: settings.genAiUsePremiumSynthesis,
  });
  const resolvedModel = provider.resolveModel(settings.genAiUsePremiumSynthesis);

  await prisma.$transaction(async (tx) => {
    await tx.paperTechnicalBrief.updateMany({
      where: {
        paperId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    await createTechnicalBriefRecord(
      tx,
      paperId,
      technicalBrief,
      provider.provider,
      resolvedModel,
    );
  });

  return true;
}

export async function selectGenAiTopPaperIds(
  paperIds: string[],
  shortlistSize: number,
  featuredCount: number,
) {
  const scored = await prisma.paperScore.findMany({
    where: {
      paperId: { in: paperIds },
      mode: BriefMode.GENAI,
      isCurrent: true,
    },
    orderBy: { totalScore: "desc" },
    take: shortlistSize,
    select: { paperId: true },
  });

  return scored.slice(0, featuredCount).map((item) => item.paperId);
}

async function createTechnicalBriefRecord(
  tx: Prisma.TransactionClient,
  paperId: string,
  technicalBrief: StructuredTechnicalBrief,
  provider: string,
  model: string,
) {
  await tx.paperTechnicalBrief.create({
    data: {
      paperId,
      oneLineVerdict: technicalBrief.oneLineVerdict,
      keyStatsJson: toJsonInput(technicalBrief.keyStats),
      focusTagsJson: toJsonInput(technicalBrief.focusTags),
      whyItMatters: technicalBrief.whyItMatters,
      whatToIgnore: technicalBrief.whatToIgnore,
      executiveTakeaway: technicalBrief.oneLineVerdict,
      bulletsJson: toJsonInput(technicalBrief.bullets),
      performanceImpact: technicalBrief.whyItMatters,
      trainingImpact: technicalBrief.whatToIgnore,
      inferenceImpact: technicalBrief.keyStats
        .map((item) => `${item.label}: ${item.value}`)
        .join(" | "),
      limitationsJson: toJsonInput([]),
      confidenceNotesJson: toJsonInput(technicalBrief.confidenceNotes),
      evidenceJson: toJsonInput(technicalBrief.evidence),
      provider,
      model,
      sourceBasis: technicalBrief.sourceBasis,
      usedFallbackAbstract: technicalBrief.usedFallbackAbstract,
    },
  });
}

export async function getCurrentTechnicalBrief(paperId: string) {
  return prisma.paperTechnicalBrief.findFirst({
    where: {
      paperId,
      isCurrent: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function isGenAiPaperReadyForPdfAnalysis(
  paper: Pick<Paper, "pdfUrl" | "abstract"> | null,
) {
  return Boolean(paper?.pdfUrl || paper?.abstract);
}
