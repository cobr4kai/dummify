import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminEditionTable } from "@/components/admin-edition-table";
import { AdminSubmitButton } from "@/components/admin-submit-button";
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
import { env } from "@/lib/env";
import { EXECUTIVE_SCORE_COMPONENT_METADATA } from "@/lib/scoring/model";
import { getAdminSnapshot } from "@/lib/search/service";
import {
  hasPdfBackedBrief,
  prioritizePapersWithPdfBackedBriefs,
} from "@/lib/technical/brief-status";
import type { ExecutiveScoreComponentKey } from "@/lib/types";
import { formatLongDateTime, formatShortDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  day?: string;
  notice?: string;
  fetched?: string;
  upserted?: string;
  generated?: string;
  brief?: string;
  focusPaper?: string;
  sort?: string;
  dir?: string;
}>;

type NoticeVariant = "success" | "highlight" | "danger";

type AdminNotice = {
  title: string;
  description: string;
  variant: NoticeVariant;
} | null;

const RANKING_WEIGHT_FIELDS: Array<{
  key: ExecutiveScoreComponentKey;
  description: string;
}> = [
  {
    key: "frontierRelevance",
    description:
      "Directly targets modern frontier-model, multimodal, agentic, or deployment-relevant AI systems.",
  },
  {
    key: "capabilityImpact",
    description:
      "Claims a meaningful change in what AI systems can do or how well they perform.",
  },
  {
    key: "realWorldImpact",
    description:
      "Could materially affect cost, deployment, workflow automation, productization, or business decision-making.",
  },
  {
    key: "evidenceStrength",
    description:
      "Includes credible comparative evidence, benchmark structure, or support strong enough to take the claim seriously.",
  },
  {
    key: "audiencePull",
    description:
      "Addresses a topic that smart non-research readers are likely to care about immediately, not just technical specialists.",
  },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin("/admin");
  const params = await searchParams;
  const selectedDay = typeof params.day === "string" && params.day ? params.day : null;
  const sortKey = typeof params.sort === "string" && params.sort ? params.sort : null;
  const sortDirection = typeof params.dir === "string" && params.dir ? params.dir : null;
  const snapshot = await getAdminSnapshot({
    announcementDay: selectedDay,
  });
  const focusPaperId = typeof params.focusPaper === "string" && params.focusPaper
    ? params.focusPaper
    : null;
  const latestRun = snapshot.runs[0] ?? null;
  const homePagePaperIds = snapshot.publishedPaperIds.length > 0
    ? snapshot.publishedPaperIds
    : prioritizePapersWithPdfBackedBriefs(snapshot.editionPapers)
        .slice(0, snapshot.settings.genAiFeaturedCount)
        .map((paper) => paper.id);
  const homePageSet = new Set(homePagePaperIds);
  const homePageBriefReadyCount = snapshot.editionPapers.filter(
    (paper) => homePageSet.has(paper.id) && hasPdfBackedBrief(paper.technicalBriefs),
  ).length;
  const homePageMissingBriefCount = Math.max(
    homePagePaperIds.length - homePageBriefReadyCount,
    0,
  );
  const notice = getAdminNotice({
    notice: typeof params.notice === "string" ? params.notice : null,
    fetched: readCount(params.fetched),
    upserted: readCount(params.upserted),
    generated: readCount(params.generated),
    briefStatus: typeof params.brief === "string" ? params.brief : null,
  });

  return (
    <PageShell currentPath="/admin">
      {notice ? (
        <section className="mb-6">
          <Card className={getNoticeCardClassName(notice.variant)}>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant={notice.variant}>Latest admin action</Badge>
                  <CardTitle className="mt-3">{notice.title}</CardTitle>
                  <CardDescription className="mt-2 max-w-3xl">
                    {notice.description}
                  </CardDescription>
                </div>
                {snapshot.selectedDay ? (
                  <Badge variant="muted">Edition {formatShortDate(snapshot.selectedDay)}</Badge>
                ) : null}
              </div>
            </CardHeader>
          </Card>
        </section>
      ) : null}

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
              Control room
            </p>
            <CardTitle>Admin and settings</CardTitle>
            <CardDescription>
              Configure the daily briefing pipeline and get explicit feedback as actions run and
              finish.
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
              <AdminSubmitButton
                idleLabel="Log out"
                pendingLabel="Logging out..."
                size="sm"
                type="submit"
                variant="secondary"
              />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider and cache status</CardTitle>
            <CardDescription>
              Runtime model policy and total briefing coverage across the dataset.
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

      <section className="mb-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
                  Homepage readiness
                </p>
                <CardTitle>What visitors see right now</CardTitle>
                <CardDescription>
                  This tracks the papers currently live on the homepage for the selected edition and
                  whether their PDF-backed executive briefs are already attached.
                </CardDescription>
              </div>
              <Badge
                variant={snapshot.publishedPaperIds.length > 0 ? "success" : "default"}
              >
                {snapshot.publishedPaperIds.length > 0
                  ? "Curated homepage live"
                  : "Automatic homepage live"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Edition mode
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {snapshot.publishedPaperIds.length > 0
                    ? "Curated homepage selection"
                    : `Automatic top ${snapshot.settings.genAiFeaturedCount} fallback`}
                </p>
              </div>
              <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Papers live now
                </p>
                <p className="mt-2 font-serif text-3xl">{homePagePaperIds.length}</p>
              </div>
              <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  PDF briefs ready
                </p>
                <p className="mt-2 font-serif text-3xl">
                  {homePageBriefReadyCount}/{homePagePaperIds.length}
                </p>
              </div>
              <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Needs attention
                </p>
                <p className="mt-2 font-serif text-3xl">{homePageMissingBriefCount}</p>
              </div>
            </div>
            {latestRun ? (
              <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getRunBadgeVariant(latestRun.status)}>
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
      </section>

      <section className="mb-6">
        <AdminEditionTable
          days={snapshot.days}
          featuredCount={snapshot.settings.genAiFeaturedCount}
          focusPaperId={focusPaperId}
          key={[
            snapshot.selectedDay ?? "no-day",
            sortKey ?? "default-sort",
            sortDirection ?? "default-dir",
            focusPaperId ?? "no-focus",
          ].join(":")}
          papers={snapshot.editionPapers}
          publishedPaperIds={snapshot.publishedPaperIds}
          selectedDay={snapshot.selectedDay}
          sortDirection={sortDirection}
          sortKey={sortKey}
        />
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Run ingestion</CardTitle>
            <CardDescription>
              Trigger the primary daily brief pipeline or backfill historical paper windows. Each
              button stays busy until the page comes back with updated results.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-2">
            <form
              action={runDailyRefreshAction}
              className="space-y-3 rounded-[24px] border border-border/80 bg-white/60 p-4"
            >
              <p className="text-sm font-semibold text-foreground">Daily refresh</p>
              <input name="selectedDay" type="hidden" value={snapshot.selectedDay ?? ""} />
              <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
              <label className="space-y-2 text-sm font-medium">
                Announcement day
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={snapshot.selectedDay ?? snapshot.latestDay ?? ""}
                  name="announcementDay"
                  type="date"
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input name="recomputeBriefs" type="checkbox" />
                Recompute executive briefs
              </label>
              <AdminSubmitButton
                idleLabel="Refresh daily brief"
                pendingLabel="Refreshing daily brief..."
                type="submit"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Use this after changing categories, models, or homepage composition to get fresh
                coverage for the selected day.
              </p>
            </form>
            <form
              action={runHistoricalRefreshAction}
              className="space-y-3 rounded-[24px] border border-border/80 bg-white/60 p-4"
            >
              <p className="text-sm font-semibold text-foreground">Historical fetch</p>
              <input name="selectedDay" type="hidden" value={snapshot.selectedDay ?? ""} />
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
                Useful for filling a missing historical window without guessing whether the job is
                still running.
              </p>
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
              <input name="selectedDay" type="hidden" value={snapshot.selectedDay ?? ""} />
              <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
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
              <AdminSubmitButton
                idleLabel="Save categories"
                pendingLabel="Saving categories..."
                type="submit"
              />
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Brief settings</CardTitle>
            <CardDescription>
              Control output counts, ranking weights, high-signal threshold, and the score bias toward frontier relevance, real-world impact, and audience pull.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateSettingsAction} className="grid gap-4 sm:grid-cols-2">
              <input name="selectedDay" type="hidden" value={snapshot.selectedDay ?? ""} />
              <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
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

              <div className="sm:col-span-2 mt-2 space-y-2">
                <p className="text-sm font-semibold text-foreground">Ranking weights</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  The visible ranking model now uses five criteria designed for business readers. Save changes, then run a manual daily refresh to rescore the current day with the new mix.
                </p>
              </div>
              {RANKING_WEIGHT_FIELDS.map(({ key, description }) => (
                <label key={key} className="space-y-2 text-sm font-medium">
                  {EXECUTIVE_SCORE_COMPONENT_METADATA[key].label}
                  <span className="block text-xs leading-5 text-muted-foreground">
                    {description}
                  </span>
                  <input
                    className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                    defaultValue={snapshot.settings.genAiRankingWeights[key]}
                    name={key}
                    step="0.01"
                    type="number"
                  />
                </label>
              ))}
              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <AdminSubmitButton
                  idleLabel="Save settings"
                  pendingLabel="Saving settings..."
                  type="submit"
                />
              </div>
            </form>
            <form action={resetSettingsAction} className="mt-3">
              <input name="selectedDay" type="hidden" value={snapshot.selectedDay ?? ""} />
              <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
              <AdminSubmitButton
                idleLabel="Reset defaults"
                pendingLabel="Resetting defaults..."
                type="submit"
                variant="secondary"
              />
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
                    <Badge variant={getRunBadgeVariant(run.status)}>{run.status}</Badge>
                    <Badge variant="muted">{run.mode}</Badge>
                    <Badge variant="muted">{run.triggerSource}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Started {formatLongDateTime(run.startedAt)}. Fetched {run.fetchedCount},
                    upserted {run.upsertedCount}, scored {run.scoreCount}, generated {" "}
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

function AdminSortStateInputs({
  sortKey,
  sortDirection,
}: {
  sortKey: string | null;
  sortDirection: string | null;
}) {
  return (
    <>
      {sortKey ? <input name="sort" type="hidden" value={sortKey} /> : null}
      {sortDirection ? <input name="dir" type="hidden" value={sortDirection} /> : null}
    </>
  );
}

function getAdminNotice(input: {
  notice: string | null;
  fetched?: number;
  upserted?: number;
  generated?: number;
  briefStatus: string | null;
}): AdminNotice {
  switch (input.notice) {
    case "daily-refresh":
      return {
        title: "Daily refresh finished",
        description: buildRunSummary(
          input,
          "The selected daily briefing run completed and the homepage/admin state has been refreshed.",
        ),
        variant: "success",
      };
    case "historical-refresh":
      return {
        title: "Historical backfill finished",
        description: buildRunSummary(
          input,
          "The historical ingestion window finished and the refreshed paper pool is now visible in admin.",
        ),
        variant: "success",
      };
    case "settings-saved":
      return {
        title: "Settings saved",
        description:
          "Your briefing settings were saved. Run a manual daily refresh to rescore the current day with the updated ranking mix.",
        variant: "success",
      };
    case "settings-reset":
      return {
        title: "Defaults restored",
        description:
          "The admin settings have been reset to the repo defaults for counts, pacing, ranking, and schedule fields.",
        variant: "highlight",
      };
    case "categories-saved":
      return {
        title: "Categories updated",
        description:
          "Source category toggles were saved. The next ingestion run will use the new enabled category set.",
        variant: "success",
      };
    case "paper-published":
      return {
        title: "Homepage selection updated",
        description:
          input.briefStatus === "ready"
            ? "That paper is now part of the curated homepage set and its PDF-backed executive brief is ready."
            : input.briefStatus === "fallback"
              ? "That paper is now part of the curated homepage set, but PDF extraction fell back to abstract-only mode, so no homepage brief will appear until a full-PDF brief is available."
              : "That paper is now part of the curated homepage set, but it still needs a PDF-backed executive brief.",
        variant: input.briefStatus === "ready" ? "success" : "highlight",
      };
    case "paper-removed":
      return {
        title: "Homepage selection updated",
        description:
          "That paper was removed from the curated homepage set. If no curated papers remain, the homepage will fall back to the automatic top list.",
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

function getNoticeCardClassName(variant: NoticeVariant) {
  if (variant === "success") {
    return "border-success/40";
  }

  if (variant === "danger") {
    return "border-danger/40";
  }

  return "border-highlight/40";
}

function getRunBadgeVariant(status: string): NoticeVariant {
  if (status === "FAILED") {
    return "danger";
  }

  if (status === "COMPLETED") {
    return "success";
  }

  return "highlight";
}

function readCount(value: string | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

