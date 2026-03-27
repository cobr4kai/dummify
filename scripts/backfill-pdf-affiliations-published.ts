import { backfillPdfAffiliationsForPublishedPapers } from "../src/lib/ingestion/service";
import { prisma } from "../src/lib/db";

function readListFlag(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const paperIds = readListFlag("PAPERBRIEF_PDF_AFFILIATIONS_PAPER_IDS");
  const fromAnnouncementDay =
    process.env.PAPERBRIEF_PDF_AFFILIATIONS_FROM_DAY?.trim() || undefined;
  const toAnnouncementDay =
    process.env.PAPERBRIEF_PDF_AFFILIATIONS_TO_DAY?.trim() || undefined;
  const force = process.env.PAPERBRIEF_PDF_AFFILIATIONS_FORCE?.trim() !== "false";

  const result = await backfillPdfAffiliationsForPublishedPapers({
    paperIds,
    fromAnnouncementDay,
    toAnnouncementDay,
    force,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
