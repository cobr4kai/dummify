import { Badge } from "@/components/ui/badge";
import { AdminIngestPanel } from "@/components/admin-ingest-panel";
import { AdminNoticeBanner, type AdminNotice } from "@/components/admin-notice-banner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminRunsList } from "@/components/admin-runs-list";
import { PageShell } from "@/components/page-shell";
import { runDailyRefreshAction, runHistoricalRefreshAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/search/service";
import { formatShortDate, getArxivAnnouncementDateString } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  notice?: string;
  fetched?: string;
  upserted?: string;
  generated?: string;
  week?: string;
  sort?: string;
  dir?: string;
}>;

export default async function AdminIngestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin("/admin/ingest");
  const params = await searchParams;
  const currentArxivAnnouncementDay = getArxivAnnouncementDateString();
  const snapshot = await getAdminSnapshot();
  const sortKey = typeof params.sort === "string" && params.sort ? params.sort : null;
  const sortDirection = typeof params.dir === "string" && params.dir ? params.dir : null;
  const notice = getIngestNotice({
    notice: typeof params.notice === "string" ? params.notice : null,
    currentArxivAnnouncementDay,
    fetched: readCount(params.fetched),
    upserted: readCount(params.upserted),
    generated: readCount(params.generated),
  });

  return (
    <PageShell
      currentPath="/admin/ingest"
      tone="utility"
      headerContent={(
        <AdminPageHeader
          badges={(
            <>
              <Badge variant="muted">
                Current RSS day {formatShortDate(currentArxivAnnouncementDay)}
              </Badge>
              <Badge variant="muted">
                Recent runs {snapshot.runs.length}
              </Badge>
              <Badge variant="muted">
                Latest ingest {snapshot.latestDay ? formatShortDate(snapshot.latestDay) : "none"}
              </Badge>
            </>
          )}
          currentPath="/admin/ingest"
          description="Run fresh pulls and backfills with the latest run history directly beneath the controls, so action and feedback stay in one workspace."
          title="Ingest"
        />
      )}
    >
      <AdminNoticeBanner contextLabel="Ingest update" notice={notice} />

      <section className="mb-6">
        <AdminIngestPanel
          currentArxivAnnouncementDay={currentArxivAnnouncementDay}
          runDailyRefreshAction={runDailyRefreshAction}
          runHistoricalRefreshAction={runHistoricalRefreshAction}
          selectedWeek={snapshot.selectedWeek}
          sortDirection={sortDirection}
          sortKey={sortKey}
        />
      </section>

      <section>
        <AdminRunsList runs={snapshot.runs} />
      </section>
    </PageShell>
  );
}

function getIngestNotice(input: {
  notice: string | null;
  currentArxivAnnouncementDay: string;
  fetched?: number;
  upserted?: number;
  generated?: number;
}): AdminNotice {
  switch (input.notice) {
    case "missing-range":
      return {
        title: "Choose a full backfill window",
        description:
          "Historical backfill needs both a start date and an end date before the job can run.",
        variant: "highlight",
      };
    case "daily-refresh-day-mismatch":
      return {
        title: "Fetch today only supports the live RSS day",
        description:
          `The daily fetch currently pulls only the active arXiv RSS announcement day (${formatShortDate(input.currentArxivAnnouncementDay)}). Use Backfill archive window for older stored days.`,
        variant: "highlight",
      };
    case "daily-refresh":
      return {
        title: "Fetch today finished",
        description: buildRunSummary(
          input,
          "The selected daily ingest run completed and the latest stored paper pool has been refreshed.",
        ),
        variant: "success",
      };
    case "daily-refresh-started":
      return {
        title: "Fetch today started",
        description:
          "The ingest job is now running in the background. The latest run card will update as progress is written.",
        variant: "highlight",
      };
    case "historical-refresh":
      return {
        title: "Backfill archive window finished",
        description: buildRunSummary(
          input,
          "The historical ingestion window finished and the refreshed archive is now available in admin.",
        ),
        variant: "success",
      };
    case "historical-refresh-started":
      return {
        title: "Backfill archive window started",
        description:
          "The historical ingest is running in the background. Large windows may take a while, but the admin page should stay responsive while the run progresses.",
        variant: "highlight",
      };
    case "ingest-already-running":
      return {
        title: "An ingest run is already in progress",
        description:
          "Wait for the current run to finish before starting another one. This keeps the app from piling extra load onto arXiv and avoids overlapping manual jobs.",
        variant: "highlight",
      };
    default:
      return null;
  }
}

function buildRunSummary(
  input: {
    fetched?: number;
    upserted?: number;
    generated?: number;
  },
  prefix: string,
) {
  const parts: string[] = [];

  if (typeof input.fetched === "number") {
    parts.push(`fetched ${input.fetched}`);
  }

  if (typeof input.upserted === "number") {
    parts.push(`upserted ${input.upserted}`);
  }

  if (typeof input.generated === "number") {
    parts.push(`generated ${input.generated} executive briefs`);
  }

  return parts.length > 0 ? `${prefix} This run ${parts.join(", ")}.` : prefix;
}

function readCount(value: string | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
