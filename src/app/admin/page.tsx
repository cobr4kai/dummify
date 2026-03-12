import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/page-shell";
import {
  logoutAction,
  resetSettingsAction,
  runDailyRefreshAction,
  runHistoricalRefreshAction,
  updateCategoriesAction,
  updateSettingsAction,
} from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/search/service";
import { env } from "@/lib/env";
import { formatLongDateTime, formatShortDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin("/admin");
  const snapshot = await getAdminSnapshot();

  return (
    <PageShell currentPath="/admin">
      <section className="mb-6 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
              Control room
            </p>
            <CardTitle>Admin and settings</CardTitle>
            <CardDescription>
              Configure the single daily briefing pipeline and inspect provider health.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge variant={env.OPENAI_API_KEY ? "success" : "highlight"}>
              OpenAI {env.OPENAI_API_KEY ? "configured" : "not configured"}
            </Badge>
            <Badge variant={env.OPENALEX_API_KEY ? "success" : "muted"}>
              OpenAlex {env.OPENALEX_API_KEY ? "configured" : "optional / off"}
            </Badge>
            <Badge variant={env.OPENAI_ENABLE_PREMIUM_SYNTHESIS ? "success" : "muted"}>
              Premium synthesis {env.OPENAI_ENABLE_PREMIUM_SYNTHESIS ? "enabled" : "disabled"}
            </Badge>
            <Badge variant="muted">
              Latest brief {snapshot.latestDay ? formatShortDate(snapshot.latestDay) : "none"}
            </Badge>
            <form action={logoutAction}>
              <Button size="sm" variant="secondary" type="submit">
                Log out
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider and cache status</CardTitle>
            <CardDescription>
              Runtime model policy and current PDF-backed briefing coverage.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Extraction model
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {env.OPENAI_EXTRACTION_MODEL}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Synthesis model
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {env.OPENAI_SYNTHESIS_MODEL}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Executive briefs
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {snapshot.technicalBriefCount} current briefs
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Cached PDFs
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {snapshot.pdfCacheCount} cached extracts
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Run ingestion</CardTitle>
            <CardDescription>
              Trigger the primary daily brief pipeline or backfill historical paper windows.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-2">
            <form
              action={runDailyRefreshAction}
              className="space-y-3 rounded-[24px] border border-border/80 bg-white/60 p-4"
            >
              <p className="text-sm font-semibold text-foreground">Daily refresh</p>
              <label className="space-y-2 text-sm font-medium">
                Announcement day
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.latestDay ?? ""}
                  name="announcementDay"
                  type="date"
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input name="recomputeBriefs" type="checkbox" />
                Recompute executive briefs
              </label>
              <Button type="submit">Refresh daily brief</Button>
            </form>
            <form
              action={runHistoricalRefreshAction}
              className="space-y-3 rounded-[24px] border border-border/80 bg-white/60 p-4"
            >
              <p className="text-sm font-semibold text-foreground">Historical fetch</p>
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
              <Button type="submit" variant="secondary">
                Run backfill
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category configuration</CardTitle>
            <CardDescription>
              Enable or disable source categories without editing code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCategoriesAction} className="space-y-3">
              {snapshot.categories.map((category) => (
                <label
                  key={category.key}
                  className="flex items-center justify-between gap-4 rounded-[22px] border border-border/80 bg-white/60 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-foreground">{category.key}</p>
                    <p className="text-sm text-muted-foreground">{category.label}</p>
                  </div>
                  <input
                    defaultChecked={category.enabled}
                    name={`enabled__${category.key}`}
                    type="checkbox"
                  />
                </label>
              ))}
              <Button type="submit">Save categories</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Brief settings</CardTitle>
            <CardDescription>
              Control output counts, ranking weights, high-signal threshold, and PDF cache path.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateSettingsAction} className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                Featured count
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.genAiFeaturedCount}
                  name="genAiFeaturedCount"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Shortlist size
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.genAiShortlistSize}
                  name="genAiShortlistSize"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                High-signal threshold
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.highBusinessRelevanceThreshold}
                  name="highBusinessRelevanceThreshold"
                  step="0.1"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                PDF cache directory
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.pdfCacheDir}
                  name="pdfCacheDir"
                  type="text"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Primary cron schedule
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.primaryCronSchedule}
                  name="primaryCronSchedule"
                  type="text"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Reconcile cron schedule
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.reconcileCronSchedule}
                  name="reconcileCronSchedule"
                  type="text"
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground sm:col-span-2">
                <input
                  defaultChecked={snapshot.settings.genAiUsePremiumSynthesis}
                  name="genAiUsePremiumSynthesis"
                  type="checkbox"
                />
                Use premium synthesis model when the environment allows it
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground sm:col-span-2">
                <input
                  defaultChecked={snapshot.settings.reconcileEnabled}
                  name="reconcileEnabled"
                  type="checkbox"
                />
                Run a lighter reconciliation ingest later in the same arXiv cycle
              </label>

              <div className="sm:col-span-2 mt-2">
                <p className="text-sm font-semibold text-foreground">Request pacing and cache</p>
              </div>
              <label className="space-y-2 text-sm font-medium">
                RSS min delay (ms)
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.rssMinDelayMs}
                  name="rssMinDelayMs"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                API min delay (ms)
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.apiMinDelayMs}
                  name="apiMinDelayMs"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Retry base delay (ms)
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.retryBaseDelayMs}
                  name="retryBaseDelayMs"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Feed cache TTL (minutes)
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.feedCacheTtlMinutes}
                  name="feedCacheTtlMinutes"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                API cache TTL (minutes)
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.settings.apiCacheTtlMinutes}
                  name="apiCacheTtlMinutes"
                  type="number"
                />
              </label>

              <div className="sm:col-span-2 mt-2">
                <p className="text-sm font-semibold text-foreground">Ranking weights</p>
              </div>
              {Object.entries(snapshot.settings.genAiRankingWeights).map(([key, value]) => (
                <label key={key} className="space-y-2 text-sm font-medium">
                  {key}
                  <input
                    className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                    defaultValue={value}
                    name={key}
                    step="0.01"
                    type="number"
                  />
                </label>
              ))}
              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <Button type="submit">Save settings</Button>
              </div>
            </form>
            <form action={resetSettingsAction} className="mt-3">
              <Button type="submit" variant="secondary">
                Reset defaults
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent ingestion runs</CardTitle>
            <CardDescription>
              Inspect fetch counts, failures, and timestamps from the latest jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ingestion runs yet.</p>
            ) : (
              snapshot.runs.map((run) => (
                <div
                  key={run.id}
                  className="rounded-[24px] border border-border/80 bg-white/60 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={run.status === "FAILED" ? "danger" : "default"}>
                      {run.status}
                    </Badge>
                    <Badge variant="muted">{run.mode}</Badge>
                    <Badge variant="muted">{run.triggerSource}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Started {formatLongDateTime(run.startedAt)}. Fetched {run.fetchedCount},
                    upserted {run.upsertedCount}, scored {run.scoreCount}, generated{" "}
                    {run.summaryCount} executive briefs.
                  </p>
                  {Array.isArray(run.logLines) && run.logLines.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm leading-6 text-foreground/90">
                      {run.logLines
                        .slice(-4)
                        .filter((line): line is string | number | boolean => line !== null)
                        .map((line, index) => (
                          <li key={`${run.id}-${index}-${String(line)}`}>- {String(line)}</li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
