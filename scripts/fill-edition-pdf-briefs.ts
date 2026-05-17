import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

type PrismaRuntime = Awaited<typeof import("../src/lib/db")>;
type PublishingRuntime = Awaited<typeof import("../src/lib/publishing/service")>;
type PaperRefetchRuntime = Awaited<typeof import("../src/lib/papers/refetch")>;
type TechnicalRuntime = Awaited<typeof import("../src/lib/technical/service")>;
type BriefStatusRuntime = Awaited<typeof import("../src/lib/technical/brief-status")>;
type SearchRuntime = Awaited<typeof import("../src/lib/search/service")>;
type DatesRuntime = Awaited<typeof import("../src/lib/utils/dates")>;

type Options = {
  week: string | null;
  dryRun: boolean;
  verifyOnly: boolean;
  limit: number | null;
  forceFetch: boolean;
  includeLive: boolean;
};

type Runtime = PrismaRuntime &
  PublishingRuntime &
  PaperRefetchRuntime &
  TechnicalRuntime &
  BriefStatusRuntime &
  SearchRuntime &
  DatesRuntime;

type EditionPaper = Awaited<ReturnType<typeof loadEditionPapers>>[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
let loadedRuntime: Runtime | null = null;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runtime = await loadRuntime();
  loadedRuntime = runtime;
  const weekStart = options.week ?? (await resolveDefaultWeek(runtime, options));
  const activeWeekStart = await runtime.resolveActiveHomepageWeekStart();

  if (!weekStart) {
    throw new Error("No curated edition week was found.");
  }

  const papers = await loadEditionPapers(runtime, weekStart);
  const missing = papers.filter((paper) => !runtime.hasPdfBackedBrief(paper.technicalBriefs));
  const selected = options.limit === null ? missing : missing.slice(0, options.limit);

  log(`Edition: ${runtime.formatWeekLabel(weekStart)} (${weekStart})`);
  if (activeWeekStart) {
    log(`Live homepage week: ${runtime.formatWeekLabel(activeWeekStart)} (${activeWeekStart})`);
  }
  log(`Selected papers: ${papers.length}`);
  log(`Missing PDF-backed briefs: ${missing.length}`);

  if (options.dryRun || options.verifyOnly) {
    printMissingPapers(missing);
    return;
  }

  if (selected.length === 0) {
    log("Nothing to do. The selected edition already has PDF-backed briefs.");
    return;
  }

  if (options.limit !== null && missing.length > selected.length) {
    log(`Processing first ${selected.length} paper(s) because --limit=${options.limit}.`);
  }

  const results = [];
  for (const [index, paper] of selected.entries()) {
    const label = `[${index + 1}/${selected.length}] ${paper.title} (${paper.arxivId}v${paper.version})`;
    log("");
    log(label);
    results.push(await fillPdfBriefForPaper(runtime, paper, options));
  }

  const refreshedPapers = await loadEditionPapers(runtime, weekStart);
  const stillMissing = refreshedPapers.filter(
    (paper) => !runtime.hasPdfBackedBrief(paper.technicalBriefs),
  );
  const generatedCount = results.filter((result) => result === "generated").length;
  const existingCount = results.filter((result) => result === "existing").length;
  const failedCount = results.length - generatedCount - existingCount;

  log("");
  log("Verification");
  log(`PDF briefs ready: ${refreshedPapers.length - stillMissing.length}/${refreshedPapers.length}`);
  log(`Generated: ${generatedCount}, already ready: ${existingCount}, unresolved: ${failedCount}`);

  if (stillMissing.length > 0) {
    printMissingPapers(stillMissing);
    process.exitCode = 1;
  }
}

async function loadRuntime(): Promise<Runtime> {
  const [
    db,
    publishing,
    refetch,
    technical,
    briefStatus,
    search,
    dates,
  ] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/publishing/service"),
    import("../src/lib/papers/refetch"),
    import("../src/lib/technical/service"),
    import("../src/lib/technical/brief-status"),
    import("../src/lib/search/service"),
    import("../src/lib/utils/dates"),
  ]);

  return {
    ...db,
    ...publishing,
    ...refetch,
    ...technical,
    ...briefStatus,
    ...search,
    ...dates,
  };
}

async function resolveDefaultWeek(runtime: Runtime, options: Options) {
  const weeks = await loadCuratedWeeks(runtime);
  if (weeks.length === 0) {
    return null;
  }

  const activeWeekStart = await runtime.resolveActiveHomepageWeekStart();
  if (options.includeLive || !activeWeekStart) {
    return weeks[0];
  }

  return weeks.find((week) => week !== activeWeekStart) ?? weeks[0];
}

async function loadCuratedWeeks(runtime: Runtime) {
  const rows = await runtime.prisma.publishedPaper.findMany({
    select: { announcementDay: true },
    orderBy: { announcementDay: "desc" },
  });
  const weeks = new Set(rows.map((row) => runtime.getWeekStart(row.announcementDay)));

  return Array.from(weeks).sort((left, right) => right.localeCompare(left));
}

async function loadEditionPapers(runtime: Runtime, weekStart: string) {
  const paperIds = await runtime.getPublishedPaperIdsForWeek(weekStart);
  if (paperIds.length === 0) {
    return [];
  }

  const papers = await runtime.prisma.paper.findMany({
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

async function fillPdfBriefForPaper(
  runtime: Runtime,
  paper: EditionPaper,
  options: Options,
) {
  if (runtime.hasPdfBackedBrief(paper.technicalBriefs)) {
    log("Already has a PDF-backed brief.");
    return "existing" as const;
  }

  const hasExtractedPdf = paper.pdfCaches.some(
    (cache) => cache.extractionStatus === "EXTRACTED" && cache.extractedJsonPath,
  );

  if (!hasExtractedPdf || options.forceFetch) {
    log(hasExtractedPdf ? "Refreshing cached PDF text." : "Fetching PDF text.");
    const refetchResult = await runtime.refetchPaperSource(paper.id, {
      forcePdfRetry: true,
    });
    log(`PDF fetch result: ${refetchResult.status}.`);

    if (!isPdfAvailableAfterRefetch(refetchResult.status)) {
      log("Skipping brief generation because PDF text is still unavailable.");
      return "failed" as const;
    }
  } else {
    log("Using cached PDF text.");
  }

  let result = await runtime.ensurePaperTechnicalBrief(paper.id, {
    force: true,
    requirePdf: true,
    pdfFetchMode: "disabled",
  });

  if (result === "pdf-required" && hasExtractedPdf && !options.forceFetch) {
    log("Cached PDF text was stale; retrying PDF fetch once.");
    const refetchResult = await runtime.refetchPaperSource(paper.id, {
      forcePdfRetry: true,
    });
    log(`PDF fetch retry result: ${refetchResult.status}.`);

    if (isPdfAvailableAfterRefetch(refetchResult.status)) {
      result = await runtime.ensurePaperTechnicalBrief(paper.id, {
        force: true,
        requirePdf: true,
        pdfFetchMode: "disabled",
      });
    }
  }

  log(`Brief result: ${result}.`);
  return result === "generated" ? "generated" : "failed";
}

function isPdfAvailableAfterRefetch(status: string) {
  return status === "metadata-refreshed-pdf-extracted" ||
    status === "metadata-stale-pdf-extracted" ||
    status === "metadata-refreshed-no-pdf-retry-needed";
}

function printMissingPapers(papers: EditionPaper[]) {
  if (papers.length === 0) {
    log("No selected papers are missing PDF-backed briefs.");
    return;
  }

  log("Still missing PDF-backed briefs:");
  for (const paper of papers) {
    const currentBrief = paper.technicalBriefs[0];
    const currentCache = paper.pdfCaches[0];
    log(
      `- ${paper.title} (${paper.arxivId}v${paper.version}) ` +
        `brief=${currentBrief?.usedFallbackAbstract === false ? "pdf" : currentBrief ? "abstract" : "missing"} ` +
        `pdf=${currentCache?.extractionStatus ?? "missing"}`,
    );
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    week: null,
    dryRun: false,
    verifyOnly: false,
    limit: null,
    forceFetch: false,
    includeLive: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printUsageAndExit();
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--verify-only") {
      options.verifyOnly = true;
      continue;
    }

    if (arg === "--force-fetch") {
      options.forceFetch = true;
      continue;
    }

    if (arg === "--include-live") {
      options.includeLive = true;
      continue;
    }

    if (arg === "--week") {
      options.week = readRequiredValue(args, index, "--week");
      index += 1;
      continue;
    }

    if (arg.startsWith("--week=")) {
      options.week = arg.slice("--week=".length);
      continue;
    }

    if (arg === "--limit") {
      options.limit = readPositiveInteger(readRequiredValue(args, index, "--limit"), "--limit");
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      options.limit = readPositiveInteger(arg.slice("--limit=".length), "--limit");
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.week && !DATE_PATTERN.test(options.week)) {
    throw new Error("--week must use YYYY-MM-DD format.");
  }

  return options;
}

function readRequiredValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function readPositiveInteger(value: string, flag: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

function printUsageAndExit() {
  log(`Usage:
  npm run edition:fill-pdf-briefs -- [--week YYYY-MM-DD] [--limit N] [--dry-run]

Options:
  --week YYYY-MM-DD  Fill the selected edition for a specific week.
  --dry-run          Show selected papers missing PDF-backed briefs without changing data.
  --verify-only      Only report readiness for the target edition.
  --limit N          Process at most N missing papers.
  --force-fetch      Refetch PDF text even if cached extracted text exists.
  --include-live     Allow the default week picker to choose the live homepage week.`);
  process.exit(0);
}

function log(message: string) {
  console.log(message);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await loadedRuntime?.prisma.$disconnect();
  });
