import { Badge } from "@/components/ui/badge";
import { AdminIngestPanel } from "@/components/admin-ingest-panel";
import { AdminIngestTracker } from "@/components/admin-ingest-tracker";
import { AdminNoticeBanner, type AdminNotice } from "@/components/admin-notice-banner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PageShell } from "@/components/page-shell";
import { runDailyRefreshAction, runHistoricalRefreshAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/search/service";
import { formatShortDate, getArxivAnnouncementDateString } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  notice?: string;
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
        <AdminIngestTracker
          initialActiveRun={snapshot.activeRun}
          initialRuns={snapshot.runs}
        />
      </section>
    </PageShell>
  );
}

function getIngestNotice(input: {
  notice: string | null;
  currentArxivAnnouncementDay: string;
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
    case "daily-refresh-started":
      return {
        title: "Fetch today started",
        description:
          "The daily ingest was accepted and is now updating in the live tracker below.",
        variant: "highlight",
      };
    case "historical-refresh-started":
      return {
        title: "Backfill archive window started",
        description:
          "The historical backfill is running now. Follow the active run card below for live phase updates.",
        variant: "highlight",
      };
    case "ingest-already-running":
      return {
        title: "An ingest run is already in progress",
        description:
          "The active run tracker below is already updating. Let that run finish before starting another ingest.",
        variant: "highlight",
      };
    default:
      return null;
  }
}
