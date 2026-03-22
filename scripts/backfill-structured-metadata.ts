import { backfillStructuredMetadata } from "../src/lib/ingestion/service";
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
  const paperIds = readListFlag("PAPERBRIEF_METADATA_PAPER_IDS");
  const fromAnnouncementDay =
    process.env.PAPERBRIEF_METADATA_FROM_DAY?.trim() || undefined;
  const toAnnouncementDay =
    process.env.PAPERBRIEF_METADATA_TO_DAY?.trim() || undefined;
  const force = process.env.PAPERBRIEF_METADATA_FORCE?.trim() !== "false";

  const result = await backfillStructuredMetadata({
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
