import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { PageShell } from "@/components/page-shell";
import { logoutAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { getAdminSnapshot } from "@/lib/search/service";
import { formatLongDateTime, formatShortDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin("/admin");
  const snapshot = await getAdminSnapshot();
  const latestRun = snapshot.runs[0] ?? null;
  const providerBadges = [
    {
      label: `OpenAI ${env.OPENAI_API_KEY ? "configured" : "not configured"}`,
      variant: env.OPENAI_API_KEY ? "success" : "highlight",
    },
    {
      label: `OpenAlex ${env.OPENALEX_API_KEY ? "configured" : "optional / off"}`,
      variant: env.OPENALEX_API_KEY ? "success" : "muted",
    },
    {
      label: `Premium synthesis ${env.OPENAI_ENABLE_PREMIUM_SYNTHESIS ? "enabled" : "disabled"}`,
      variant: env.OPENAI_ENABLE_PREMIUM_SYNTHESIS ? "success" : "muted",
    },
  ] as const;

  return (
    <PageShell
      currentPath="/admin"
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
              <Badge variant="muted">
                Latest ingest {snapshot.latestDay ? formatShortDate(snapshot.latestDay) : "none"}
              </Badge>
              <Badge variant="muted">
                Active edition {snapshot.activeHomepageWeekLabel ?? "none"}
              </Badge>
            </>
          )}
          currentPath="/admin"
          description="Keep an eye on what is live, how healthy the briefing pipeline is, and where to jump next without carrying every admin task on one page."
          title="Overview"
        />
      )}
    >
      <section className="mb-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Live homepage week"
          tone="text-sm leading-6"
          value={snapshot.activeHomepageWeekLabel ?? "No active week yet"}
        />
        <MetricCard
          label="Papers live now"
          tone="metric-value text-3xl"
          value={String(snapshot.activeHomepagePaperIds.length)}
        />
        <MetricCard
          label="Brief readiness"
          tone="metric-value text-3xl"
          value={`${snapshot.activeHomepageBriefReadyCount}/${snapshot.activeHomepagePaperIds.length}`}
        />
        <MetricCard
          label="Needs attention"
          tone="metric-value text-3xl"
          value={String(snapshot.activeHomepageMissingBriefCount)}
        />
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>
              Jump into the workspace that matches the job you are trying to do.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ActionLink
              description="Curate a week, set the live homepage week, and manage the public order."
              href="/admin/edition"
              label="Edit current edition"
            />
            <ActionLink
              description="Fetch today’s papers, backfill a date window, and inspect recent runs together."
              href="/admin/ingest"
              label="Run ingest"
            />
            <ActionLink
              description="Adjust scoring, runtime policy, cache behavior, and source categories."
              href="/admin/settings"
              label="Open settings"
            />
            <ActionLink
              description="Review subscriber growth separately from ingest and editorial work."
              href="/admin/signups"
              label="Open signups"
            />
            <form action={logoutAction} className="pt-2">
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
            <CardTitle>Provider and coverage status</CardTitle>
            <CardDescription>
              Runtime model policy and current storage coverage across the archive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {providerBadges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Extraction model" tone="text-sm leading-6" value={env.OPENAI_EXTRACTION_MODEL} />
              <MetricCard label="Synthesis model" tone="text-sm leading-6" value={env.OPENAI_SYNTHESIS_MODEL} />
              <MetricCard label="Current briefs" tone="metric-value text-3xl" value={String(snapshot.technicalBriefCount)} />
              <MetricCard label="Cached extracts" tone="metric-value text-3xl" value={String(snapshot.pdfCacheCount)} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Live homepage state</CardTitle>
            <CardDescription>
              Separate from whichever edition week you may edit next.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Live mode"
              tone="text-sm leading-6"
              value={snapshot.activeHomepageIsCurated ? "Curated weekly selection" : "No curated papers selected"}
            />
            <MetricCard
              label="Selected editor week"
              tone="text-sm leading-6"
              value={snapshot.selectedWeekLabel ?? "No week selected"}
            />
            <MetricCard
              label="Latest completed week"
              tone="text-sm leading-6"
              value={snapshot.latestCompletedWeekStart ? formatShortDate(snapshot.latestCompletedWeekStart) : "None"}
            />
            <MetricCard
              label="Stored weeks"
              tone="metric-value text-3xl"
              value={String(snapshot.weeks.length)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest ingest run</CardTitle>
            <CardDescription>
              The freshest operational signal before you jump into ingest details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latestRun ? (
              <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={latestRun.status === "COMPLETED" ? "success" : "highlight"}>
                    {latestRun.status}
                  </Badge>
                  <Badge variant="muted">{latestRun.mode}</Badge>
                  <Badge variant="muted">{latestRun.triggerSource}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Started {formatLongDateTime(latestRun.startedAt)}. Fetched {latestRun.fetchedCount},
                  upserted {latestRun.upsertedCount}, scored {latestRun.scoreCount}, and generated{" "}
                  {latestRun.summaryCount} executive briefs.
                </p>
                {Array.isArray(latestRun.logLines) && latestRun.logLines.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm leading-6 text-foreground/90">
                    {latestRun.logLines
                      .slice(-3)
                      .filter((line): line is string | number | boolean => line !== null)
                      .map((line, index) => (
                        <li key={`${latestRun.id}-${index}-${String(line)}`}>- {String(line)}</li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No ingestion runs yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}

function ActionLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      className="rounded-[24px] border border-border/80 bg-white/60 px-4 py-4 transition-colors hover:border-foreground/20 hover:bg-white/75"
      href={href}
    >
      <p className="font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-foreground ${tone}`}>{value}</p>
    </div>
  );
}
