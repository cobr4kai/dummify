import { AdminSortStateInputs } from "@/components/admin-sort-state-inputs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate } from "@/lib/utils/dates";

export function AdminIngestPanel({
  currentArxivAnnouncementDay,
  selectedWeek,
  runDailyRefreshAction,
  runHistoricalRefreshAction,
  sortKey,
  sortDirection,
  title = "Fetch papers",
  description = "Run the manual daily ingest pipeline or backfill historical paper windows. The public site still rolls stored days up into weekly editions.",
}: {
  currentArxivAnnouncementDay: string;
  selectedWeek?: string | null;
  runDailyRefreshAction: (formData: FormData) => Promise<void>;
  runHistoricalRefreshAction: (formData: FormData) => Promise<void>;
  sortKey?: string | null;
  sortDirection?: string | null;
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-2">
        <form
          action={runDailyRefreshAction}
          className="space-y-3 rounded-[24px] border border-border/80 bg-white/60 p-4"
        >
          <p className="text-sm font-semibold text-foreground">Fetch today</p>
          <input name="selectedWeek" type="hidden" value={selectedWeek ?? ""} />
          <input name="announcementDay" type="hidden" value={currentArxivAnnouncementDay} />
          <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
          <div className="rounded-[22px] border border-border/80 bg-white/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Current arXiv RSS day
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {formatShortDate(currentArxivAnnouncementDay)}
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input name="recomputeBriefs" type="checkbox" />
            Recompute executive briefs
          </label>
          <AdminSubmitButton
            idleLabel="Run daily ingest"
            pendingLabel="Running daily ingest..."
            type="submit"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            This fetches the current arXiv RSS announcement day only.
          </p>
        </form>

        <form
          action={runHistoricalRefreshAction}
          className="space-y-3 rounded-[24px] border border-border/80 bg-white/60 p-4"
        >
          <p className="text-sm font-semibold text-foreground">Backfill archive window</p>
          <input name="selectedWeek" type="hidden" value={selectedWeek ?? ""} />
          <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
          <label className="space-y-2 text-sm font-medium">
            From
            <input
              className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
              name="from"
              type="date"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            To
            <input
              className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
              name="to"
              type="date"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input name="recomputeBriefs" type="checkbox" />
            Recompute executive briefs
          </label>
          <AdminSubmitButton
            idleLabel="Run backfill"
            pendingLabel="Running backfill..."
            type="submit"
            variant="secondary"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Use this for missing historical windows or metadata backfills.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
