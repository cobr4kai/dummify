import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminSortStateInputs } from "@/components/admin-sort-state-inputs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { formatLongDateTime, formatWeekLabel } from "@/lib/utils/dates";

type LatestRun = {
  status: string;
  mode: string;
  triggerSource: string;
  startedAt: Date;
  fetchedCount: number;
  upsertedCount: number;
  summaryCount: number;
} | null;

export function AdminHomepageStateCard({
  activeHomepageWeekLabel,
  activeHomepageWeekStart,
  activeHomepageIsCurated,
  activeHomepagePaperIds,
  activeHomepageBriefReadyCount,
  activeHomepageMissingBriefCount,
  selectedWeek,
  weeks,
  latestRun,
  action,
  sortKey,
  sortDirection,
}: {
  activeHomepageWeekLabel: string | null;
  activeHomepageWeekStart: string | null;
  activeHomepageIsCurated: boolean;
  activeHomepagePaperIds: string[];
  activeHomepageBriefReadyCount: number;
  activeHomepageMissingBriefCount: number;
  selectedWeek: string | null;
  weeks: string[];
  latestRun: LatestRun;
  action: (formData: FormData) => Promise<void>;
  sortKey?: string | null;
  sortDirection?: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
              Live now
            </p>
            <CardTitle>Public homepage state</CardTitle>
            <CardDescription>
              This tracks the single weekly edition currently powering `/`, separate from whatever
              week you may be editing elsewhere.
            </CardDescription>
          </div>
          <Badge variant={activeHomepageIsCurated ? "success" : "muted"}>
            {activeHomepageIsCurated ? "Curated homepage live" : "Homepage waiting for curation"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Active week
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {activeHomepageWeekLabel ?? "No active week yet"}
            </p>
          </div>
          <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Edition mode
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {activeHomepageIsCurated ? "Curated weekly selection" : "No curated papers selected"}
            </p>
          </div>
          <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Papers live now
            </p>
            <p className="metric-value mt-2 text-3xl text-foreground">
              {activeHomepagePaperIds.length}
            </p>
          </div>
          <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              PDF briefs ready
            </p>
            <p className="metric-value mt-2 text-3xl text-foreground">
              {activeHomepageBriefReadyCount}/{activeHomepagePaperIds.length}
            </p>
          </div>
          <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Needs attention
            </p>
            <p className="metric-value mt-2 text-3xl text-foreground">
              {activeHomepageMissingBriefCount}
            </p>
          </div>
        </div>

        <form
          action={action}
          className="grid gap-3 rounded-[24px] border border-border/80 bg-white/60 p-4 xl:grid-cols-[1fr_auto]"
        >
          <input name="selectedWeek" type="hidden" value={selectedWeek ?? ""} />
          <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
          <label className="space-y-2 text-sm font-medium">
            Active homepage week
            <select
              className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
              defaultValue={activeHomepageWeekStart ?? ""}
              name="activeHomepageWeekStart"
            >
              {weeks.map((week) => (
                <option key={week} value={week}>
                  {formatWeekLabel(week)}
                </option>
              ))}
            </select>
          </label>
          <div className="xl:self-end">
            <AdminSubmitButton
              idleLabel="Set live homepage week"
              pendingLabel="Setting live homepage week..."
              type="submit"
            />
          </div>
          <p className="text-xs leading-5 text-muted-foreground xl:col-span-2">
            Changing this updates the public homepage immediately. Use the edition workspace to
            curate papers before or after switching the live week.
          </p>
        </form>

        {latestRun ? (
          <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={latestRun.status === "COMPLETED" ? "success" : "highlight"}>
                Latest run {latestRun.status.toLowerCase()}
              </Badge>
              <Badge variant="muted">{latestRun.mode}</Badge>
              <Badge variant="muted">{latestRun.triggerSource}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-foreground/90">
              Started {formatLongDateTime(latestRun.startedAt)}. Fetched {latestRun.fetchedCount},
              upserted {latestRun.upsertedCount}, and generated {latestRun.summaryCount} executive
              briefs.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
