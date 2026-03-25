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
  error?: string;
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
    error: readStringParam(params.error),
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
  error?: string | null;
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
    case "historical-refresh":
      return {
        title: "Backfill archive window finished",
        description: buildRunSummary(
          input,
          "The historical ingestion window finished and the refreshed archive is now available in admin.",
        ),
        variant: "success",
      };
    case "daily-refresh-failed":
      return {
        title: "Fetch today did not finish",
        description: input.error
          ? `The ingest request was stopped before completion. ${input.error}`
          : "The ingest request was stopped before completion. The existing stored archive is unchanged.",
        variant: "danger",
      };
    case "historical-refresh-failed":
      return {
        title: "Backfill archive window did not finish",
        description: input.error
          ? `The backfill request was stopped before completion. ${input.error}`
          : "The backfill request was stopped before completion. The existing stored archive is unchanged.",
        variant: "danger",
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

function readStringParam(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
