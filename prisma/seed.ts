import { BriefMode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { demoPaperFixtures } from "../data/mock/demo-fixtures";
import { demoTechnicalBriefFixtures } from "../data/mock/demo-technical-briefs";
import { ensureDefaultSettings, getAppSettings } from "@/lib/settings/service";
import { computeBriefScore } from "@/lib/scoring/service";
import { toJsonInput } from "@/lib/utils/prisma";

async function main() {
  await ensureDefaultSettings();
  const settings = await getAppSettings();

  for (const fixture of demoPaperFixtures) {
    const paper = await prisma.paper.upsert({
      where: { arxivId: fixture.paper.arxivId },
      update: {
        version: fixture.paper.version,
        versionedId: fixture.paper.versionedId,
        title: fixture.paper.title,
        abstract: fixture.paper.abstract,
        authorsJson: toJsonInput(fixture.paper.authors),
        authorsText: fixture.paper.authors.join(", "),
        categoriesJson: toJsonInput(fixture.paper.categories),
        sourceFeedCategoriesJson: toJsonInput(fixture.paper.sourceFeedCategories),
        categoryText: fixture.paper.categories.join(" "),
        primaryCategory: fixture.paper.primaryCategory,
        publishedAt: fixture.paper.publishedAt,
        updatedAt: fixture.paper.updatedAt,
        announcementDay: fixture.paper.announcementDay,
        announceType: fixture.paper.announceType,
        comment: fixture.paper.comment,
        journalRef: fixture.paper.journalRef,
        doi: fixture.paper.doi,
        abstractUrl: fixture.paper.links.abs,
        pdfUrl: fixture.paper.links.pdf,
        links: toJsonInput(fixture.paper.links),
        sourceMetadata: toJsonInput(fixture.paper.sourceMetadata),
        sourcePayload: toJsonInput(fixture.paper.sourcePayload),
        searchText: `${fixture.paper.title} ${fixture.paper.abstract}`.toLowerCase(),
        isDemoData: true,
      },
      create: {
        arxivId: fixture.paper.arxivId,
        version: fixture.paper.version,
        versionedId: fixture.paper.versionedId,
        title: fixture.paper.title,
        abstract: fixture.paper.abstract,
        authorsJson: toJsonInput(fixture.paper.authors),
        authorsText: fixture.paper.authors.join(", "),
        categoriesJson: toJsonInput(fixture.paper.categories),
        sourceFeedCategoriesJson: toJsonInput(fixture.paper.sourceFeedCategories),
        categoryText: fixture.paper.categories.join(" "),
        primaryCategory: fixture.paper.primaryCategory,
        publishedAt: fixture.paper.publishedAt,
        updatedAt: fixture.paper.updatedAt,
        announcementDay: fixture.paper.announcementDay,
        announceType: fixture.paper.announceType,
        comment: fixture.paper.comment,
        journalRef: fixture.paper.journalRef,
        doi: fixture.paper.doi,
        abstractUrl: fixture.paper.links.abs,
        pdfUrl: fixture.paper.links.pdf,
        links: toJsonInput(fixture.paper.links),
        sourceMetadata: toJsonInput(fixture.paper.sourceMetadata),
        sourcePayload: toJsonInput(fixture.paper.sourcePayload),
        searchText: `${fixture.paper.title} ${fixture.paper.abstract}`.toLowerCase(),
        isDemoData: true,
      },
    });

    await resetCurrentArtifacts(paper.id);

    const briefScore = computeBriefScore(
      fixture.paper,
      settings.genAiRankingWeights,
    );

    await prisma.paperScore.create({
      data: {
        paperId: paper.id,
        mode: BriefMode.GENAI,
        scoringVersion: "demo-seed-executive-v1",
        totalScore: briefScore.totalScore,
        businessRelevanceScore: briefScore.frontierRelevanceScore,
        strategyFitScore: 0,
        financeFitScore: 0,
        procurementFitScore: 0,
        breakdown: toJsonInput(briefScore.breakdown),
        audienceFit: toJsonInput({}),
        focusAreas: Prisma.JsonNull,
        weights: toJsonInput(settings.genAiRankingWeights),
        rationale: briefScore.rationale,
      },
    });

    const technicalFixture = demoTechnicalBriefFixtures.find(
      (item) => item.arxivId === fixture.paper.arxivId,
    );

    if (technicalFixture) {
      await prisma.paperTechnicalBrief.create({
        data: {
          paperId: paper.id,
          oneLineVerdict: technicalFixture.brief.oneLineVerdict,
          keyStatsJson: toJsonInput(technicalFixture.brief.keyStats),
          focusTagsJson: toJsonInput(technicalFixture.brief.focusTags),
          whyItMatters: technicalFixture.brief.whyItMatters,
          whatToIgnore: technicalFixture.brief.whatToIgnore,
          executiveTakeaway: technicalFixture.brief.oneLineVerdict,
          bulletsJson: toJsonInput(technicalFixture.brief.bullets),
          performanceImpact: technicalFixture.brief.whyItMatters,
          trainingImpact: technicalFixture.brief.whatToIgnore,
          inferenceImpact: technicalFixture.brief.keyStats
            .map((item) => `${item.label}: ${item.value}`)
            .join(" | "),
          limitationsJson: toJsonInput([]),
          confidenceNotesJson: toJsonInput(technicalFixture.brief.confidenceNotes),
          evidenceJson: toJsonInput(technicalFixture.brief.evidence),
          provider: "mock",
          model: "demo-fixture",
          sourceBasis: technicalFixture.brief.sourceBasis,
          usedFallbackAbstract: technicalFixture.brief.usedFallbackAbstract,
        },
      });

      await prisma.paperPdfCache.create({
        data: {
          paperId: paper.id,
          sourceUrl:
            fixture.paper.links.pdf ??
            `https://arxiv.org/pdf/${fixture.paper.arxivId}v${fixture.paper.version}.pdf`,
          filePath: null,
          extractedJsonPath: null,
          fileSizeBytes: null,
          pageCount: 9,
          extractionStatus: "EXTRACTED",
          extractionError: null,
          usedFallbackAbstract: false,
          fetchedAt: new Date(),
          extractedAt: new Date(),
        },
      });
    }
  }

  console.log("Seeded PaperBrief defaults, executive scores, and daily brief fixtures.");
}

async function resetCurrentArtifacts(paperId: string) {
  await prisma.$transaction([
    prisma.paperScore.updateMany({
      where: { paperId, isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.paperSummary.updateMany({
      where: { paperId, isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.paperTechnicalBrief.updateMany({
      where: { paperId, isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.paperPdfCache.updateMany({
      where: { paperId, isCurrent: true },
      data: { isCurrent: false },
    }),
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
