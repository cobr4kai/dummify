import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AdminEditionTable } from "@/components/admin-edition-table";
import { AdminHomepageStateCard } from "@/components/admin-homepage-state-card";
import { AdminNoticeBanner, type AdminNotice } from "@/components/admin-notice-banner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PageShell } from "@/components/page-shell";
import { setActiveHomepageDayAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/search/service";
import { getWeekStart } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";
const EDITION_PAGE_SIZE = 350;

type SearchParams = Promise<{
  week?: string;
  day?: string;
  notice?: string;
  brief?: string;
  focusPaper?: string;
  sort?: string;
  dir?: string;
  q?: string;
  page?: string;
}>;

export default async function AdminEditionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin("/admin/edition");
  const params = await searchParams;
  const selectedWeek =
    typeof params.week === "string" && params.week
      ? params.week
      : typeof params.day === "string" && params.day
        ? getWeekStart(params.day)
        : null;
  const sortKey = typeof params.sort === "string" && params.sort ? params.sort : null;
  const sortDirection = typeof params.dir === "string" && params.dir ? params.dir : null;
  const focusPaperId = typeof params.focusPaper === "string" && params.focusPaper
    ? params.focusPaper
    : null;
  const editionQuery = typeof params.q === "string" ? params.q.trim() : "";
  const editionPage = Math.max(
    1,
    Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1,
  );
  const snapshot = await getAdminSnapshot({
    weekStart: selectedWeek,
    includeEditionData: true,
    editionOffset: (editionPage - 1) * EDITION_PAGE_SIZE,
    editionQuery,
  });
  const notice = getEditionNotice({
    notice: typeof params.notice === "string" ? params.notice : null,
    briefStatus: typeof params.brief === "string" ? params.brief : null,
  });
  const liveAndEditingDiffer =
    Boolean(snapshot.activeHomepageWeekStart) &&
    Boolean(snapshot.selectedWeek) &&
    snapshot.activeHomepageWeekStart !== snapshot.selectedWeek;

  return (
    <PageShell
      currentPath="/admin/edition"
      tone="utility"
      headerContent={(
        <AdminPageHeader
          badges={(
            <>
              <Badge variant={snapshot.activeHomepageIsCurated ? "success" : "muted"}>
                {snapshot.activeHomepageIsCurated
                  ? "Curated homepage live"
                  : "Homepage waiting for curation"}
              </Badge>
              <Badge variant="muted">Live now {snapshot.activeHomepageWeekLabel ?? "none"}</Badge>
              <Badge variant="muted">Editing {snapshot.selectedWeekLabel ?? "none"}</Badge>
            </>
          )}
          currentPath="/admin/edition"
          description="Separate what visitors see right now from the week you are actively curating, so publishing decisions are easier to reason about."
          title="Edition"
        />
      )}
    >
      <AdminNoticeBanner
        contextLabel="Edition update"
        notice={notice}
        trailingBadge={snapshot.selectedWeekLabel}
      />

      <section className="mb-6">
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-3">
            <StatusPill label="Live now" value={snapshot.activeHomepageWeekLabel ?? "No live week"} />
            <StatusPill label="Editing week" value={snapshot.selectedWeekLabel ?? "No week selected"} />
            <StatusPill
              label="Status"
              value={liveAndEditingDiffer ? "Not live yet" : "Matches public homepage"}
              variant={liveAndEditingDiffer ? "highlight" : "success"}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <AdminHomepageStateCard
          action={setActiveHomepageDayAction}
          activeHomepageBriefReadyCount={snapshot.activeHomepageBriefReadyCount}
          activeHomepageIsCurated={snapshot.activeHomepageIsCurated}
          activeHomepageMissingBriefCount={snapshot.activeHomepageMissingBriefCount}
          activeHomepagePaperIds={snapshot.activeHomepagePaperIds}
          activeHomepageWeekLabel={snapshot.activeHomepageWeekLabel}
          activeHomepageWeekStart={snapshot.activeHomepageWeekStart}
          latestRun={snapshot.activeRun ?? snapshot.runs[0] ?? null}
          selectedWeek={snapshot.selectedWeek}
          sortDirection={sortDirection}
          sortKey={sortKey}
          weeks={snapshot.weeks}
        />
      </section>

      <section>
        <AdminEditionTable
          activeHomepageWeekStart={snapshot.activeHomepageWeekStart}
          focusPaperId={focusPaperId}
          key={[
            snapshot.selectedWeek ?? "no-week",
            sortKey ?? "default-sort",
            sortDirection ?? "default-dir",
            focusPaperId ?? "no-focus",
          ].join(":")}
          papers={snapshot.editionPapers}
          paperLimit={snapshot.editionPaperLimit}
          paperOffset={snapshot.editionPaperOffset}
          paperQuery={snapshot.editionQuery}
          paperTotal={snapshot.editionPaperTotal}
          publishedPaperIds={snapshot.publishedPaperIds}
          selectedWeek={snapshot.selectedWeek}
          sortDirection={sortDirection}
          sortKey={sortKey}
          weeks={snapshot.weeks}
        />
      </section>
    </PageShell>
  );
}

function getEditionNotice(input: {
  notice: string | null;
  briefStatus: string | null;
}): AdminNotice {
  switch (input.notice) {
    case "homepage-day-set":
      return {
        title: "Live homepage week updated",
        description:
          "The public homepage now resolves from the selected active week. If that week has no curated papers yet, the homepage will stay empty until you add them.",
        variant: "success",
      };
    case "paper-published":
      return {
        title: "Curated set updated",
        description:
          input.briefStatus === "ready"
            ? "That paper is now part of the curated set for the selected week, and its PDF-backed executive brief is ready."
            : input.briefStatus === "fallback"
              ? "That paper is now part of the curated set for the selected week, but PDF extraction fell back to abstract-only mode, so no homepage brief will appear until a full-PDF brief is available."
              : "That paper is now part of the curated set for the selected week, but it still needs a PDF-backed executive brief.",
        variant: input.briefStatus === "ready" ? "success" : "highlight",
      };
    case "paper-removed":
      return {
        title: "Curated set updated",
        description:
          "That paper was removed from the curated set for the selected week. If no curated papers remain for that week, the homepage for that week will stay empty until you add papers back.",
        variant: "highlight",
      };
    case "homepage-order-saved":
      return {
        title: "Homepage order updated",
        description:
          "The curated homepage sequence was updated. The public homepage now uses this order for the selected week.",
        variant: "success",
      };
    default:
      return null;
  }
}

function StatusPill({
  label,
  value,
  variant = "muted",
}: {
  label: string;
  value: string;
  variant?: "success" | "highlight" | "muted";
}) {
  return (
    <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <Badge variant={variant}>{value}</Badge>
      </div>
    </div>
  );
}
