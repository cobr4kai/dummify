import { prisma } from "../src/lib/db";
import { z } from "zod";
import { ensurePaperTechnicalBrief } from "../src/lib/technical/service";
import { parseJsonValue } from "../src/lib/utils/json";

async function main() {
  const arxivId = process.argv[2];

  if (!arxivId) {
    throw new Error("Usage: node --env-file=.env.local --import tsx scripts/generate-brief-for-paper.ts <arxivId>");
  }

  const paper = await prisma.paper.findUnique({
    where: { arxivId },
    include: {
      technicalBriefs: {
        where: { isCurrent: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!paper) {
    throw new Error(`No paper found for arXiv ID ${arxivId}.`);
  }

  await ensurePaperTechnicalBrief(paper.id, { force: true });

  const refreshed = await prisma.paper.findUnique({
    where: { id: paper.id },
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

  const brief = refreshed?.technicalBriefs[0];
  const pdfCache = refreshed?.pdfCaches[0];

  if (!brief) {
    throw new Error(`No technical brief was generated for ${arxivId}.`);
  }

  const bulletSchema = z.array(
    z.object({
      text: z.string(),
    }),
  );
  const bullets = parseJsonValue<
    Array<{
      text: string;
    }>
  >(brief.bulletsJson, bulletSchema, []);

  console.log(JSON.stringify({
    arxivId,
    title: refreshed?.title,
    sourceBasis: brief.sourceBasis,
    usedFallbackAbstract: brief.usedFallbackAbstract,
    provider: brief.provider,
    model: brief.model,
    extractionStatus: pdfCache?.extractionStatus ?? null,
    pageCount: pdfCache?.pageCount ?? null,
    oneLineVerdict: brief.oneLineVerdict,
    bullets: bullets.map((bullet) => bullet.text),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
