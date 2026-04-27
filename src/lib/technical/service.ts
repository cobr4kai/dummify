import { BriefMode, Prisma, type Paper } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ensurePaperPdfExtraction } from "@/lib/pdf/service";
import { paperToSourceRecord } from "@/lib/papers/record";
import { getTechnicalBriefProvider } from "@/lib/providers";
import { getAppSettings } from "@/lib/settings/service";
import { normalizeTechnicalBriefLead } from "@/lib/technical/brief-text";
import { parseJsonValue } from "@/lib/utils/json";
import { toJsonInput } from "@/lib/utils/prisma";
import type { StructuredTechnicalBrief } from "@/lib/types";

export type EnsurePaperTechnicalBriefResult =
  | "generated"
  | "existing"
  | "provider-unavailable"
  | "paper-missing"
  | "pdf-required";

const MANUAL_TECHNICAL_BRIEF_PROVIDER_PREFIX = "manual:";

const manualEditableBulletSchema = z.array(
  z.object({
    label: z.string(),
    text: z.string(),
    impactArea: z.enum([
      "implication",
      "watch",
      "vendor-question",
      "assumption",
      "adoption-signal",
      "limitation",
    ]),
    citations: z.array(
      z.object({
        page: z.number(),
        section: z.string().nullable().optional(),
        quote: z.string().nullable().optional(),
      }),
    ),
  }),
);

const manualTechnicalBriefEditSchema = z.object({
  oneLineVerdict: z.string().min(40).max(900),
  bullets: z.array(z.string().min(20).max(700)).min(3).max(5),
});

export async function ensurePaperTechnicalBrief(
  paperId: string,
  options: { force?: boolean; requirePdf?: boolean } = {},
): Promise<EnsurePaperTechnicalBriefResult> {
  const existing = await prisma.paperTechnicalBrief.findFirst({
    where: {
      paperId,
      isCurrent: true,
    },
  });

  if (
    existing &&
    !options.force &&
    (!options.requirePdf || !existing.usedFallbackAbstract)
  ) {
    return "existing";
  }

  const provider = getTechnicalBriefProvider();
  if (!provider) {
    return "provider-unavailable";
  }

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
  });

  if (!paper) {
    return "paper-missing";
  }

  const settings = await getAppSettings();
  const pdfResult = await ensurePaperPdfExtraction(paper, settings.pdfCacheDir, {
    fallbackRetryCooldownMinutes: settings.pdfFallbackRetryCooldownMinutes,
    fetchMode: settings.pdfFetchMode,
  });
  if (options.requirePdf && pdfResult.usedFallbackAbstract) {
    return "pdf-required";
  }

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

  return "generated";
}

export function isManualTechnicalBriefProvider(provider: string | null | undefined) {
  return Boolean(provider?.startsWith(MANUAL_TECHNICAL_BRIEF_PROVIDER_PREFIX));
}

function toManualTechnicalBriefProvider(provider: string) {
  return isManualTechnicalBriefProvider(provider)
    ? provider
    : `${MANUAL_TECHNICAL_BRIEF_PROVIDER_PREFIX}${provider}`;
}

function toGeneratedTechnicalBriefProvider(provider: string) {
  return isManualTechnicalBriefProvider(provider)
    ? provider.slice(MANUAL_TECHNICAL_BRIEF_PROVIDER_PREFIX.length)
    : provider;
}

export async function saveManualTechnicalBriefEdits(input: {
  paperId: string;
  oneLineVerdict: string;
  bullets: string[];
}) {
  const current = await prisma.paperTechnicalBrief.findFirst({
    where: {
      paperId: input.paperId,
      isCurrent: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!current) {
    return "missing" as const;
  }

  const nextVerdict = normalizeTechnicalBriefLead(input.oneLineVerdict);
  const nextBullets = input.bullets
    .map((bullet) => bullet.trim())
    .filter((bullet) => bullet.length > 0);
  const parsedInput = manualTechnicalBriefEditSchema.safeParse({
    oneLineVerdict: nextVerdict,
    bullets: nextBullets,
  });

  if (!parsedInput.success) {
    return "invalid" as const;
  }

  const existingBullets = parseJsonValue(
    current.bulletsJson,
    manualEditableBulletSchema,
    [],
  );

  await prisma.$transaction(async (tx) => {
    await tx.paperTechnicalBrief.updateMany({
      where: {
        paperId: input.paperId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    await tx.paperTechnicalBrief.create({
      data: {
        paperId: current.paperId,
        oneLineVerdict: parsedInput.data.oneLineVerdict,
        keyStatsJson: toJsonInput(current.keyStatsJson),
        focusTagsJson: toJsonInput(current.focusTagsJson),
        whyItMatters: current.whyItMatters,
        whatToIgnore: current.whatToIgnore,
        affiliationsJson: toJsonInput(current.affiliationsJson ?? []),
        executiveTakeaway: parsedInput.data.oneLineVerdict,
        bulletsJson: toJsonInput(
          parsedInput.data.bullets.map((text, index) => ({
            label: existingBullets[index]?.label ?? `Point ${index + 1}`,
            text,
            impactArea: existingBullets[index]?.impactArea ?? "implication",
            citations: existingBullets[index]?.citations ?? [],
          })),
        ),
        performanceImpact: current.performanceImpact,
        trainingImpact: current.trainingImpact,
        inferenceImpact: current.inferenceImpact,
        limitationsJson: toJsonInput(current.limitationsJson),
        confidenceNotesJson: toJsonInput(current.confidenceNotesJson),
        evidenceJson: toJsonInput(current.evidenceJson),
        provider: toManualTechnicalBriefProvider(current.provider),
        model: current.model,
        sourceBasis: current.sourceBasis,
        usedFallbackAbstract: current.usedFallbackAbstract,
      },
    });
  });

  return "saved" as const;
}

export async function revertManualTechnicalBriefEdits(paperId: string) {
  const current = await prisma.paperTechnicalBrief.findFirst({
    where: {
      paperId,
      isCurrent: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!current) {
    return "missing" as const;
  }

  if (!isManualTechnicalBriefProvider(current.provider)) {
    return "not-manual" as const;
  }

  const previousGenerated = await prisma.paperTechnicalBrief.findFirst({
    where: {
      paperId,
      isCurrent: false,
      provider: {
        not: {
          startsWith: MANUAL_TECHNICAL_BRIEF_PROVIDER_PREFIX,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!previousGenerated) {
    return "no-generated-version" as const;
  }

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

    await tx.paperTechnicalBrief.update({
      where: {
        id: previousGenerated.id,
      },
      data: {
        isCurrent: true,
        provider: toGeneratedTechnicalBriefProvider(previousGenerated.provider),
      },
    });
  });

  return "reverted" as const;
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
  const normalizedVerdict = normalizeTechnicalBriefLead(technicalBrief.oneLineVerdict);

  await tx.paperTechnicalBrief.create({
    data: {
      paperId,
      oneLineVerdict: normalizedVerdict,
      keyStatsJson: toJsonInput(technicalBrief.keyStats),
      focusTagsJson: toJsonInput(technicalBrief.focusTags),
      whyItMatters: technicalBrief.whyItMatters,
      whatToIgnore: technicalBrief.whatToIgnore,
      affiliationsJson: toJsonInput(technicalBrief.affiliations ?? []),
      executiveTakeaway: normalizedVerdict,
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

export async function getCurrentTechnicalBriefStatus(paperId: string) {
  return prisma.paperTechnicalBrief.findFirst({
    where: {
      paperId,
      isCurrent: true,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      usedFallbackAbstract: true,
    },
  });
}

export function isGenAiPaperReadyForPdfAnalysis(
  paper: Pick<Paper, "pdfUrl" | "abstract"> | null,
) {
  return Boolean(paper?.pdfUrl || paper?.abstract);
}
