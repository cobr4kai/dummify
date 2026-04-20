"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRunBadgeVariant } from "@/lib/admin/ui";
import {
  getRenderablePhaseTimeline,
  type AdminIngestionRun,
  type IngestionPhaseProgress,
} from "@/lib/ingestion/progress";
import { cn } from "@/lib/utils/cn";
import { formatLongDateTime } from "@/lib/utils/dates";

export function AdminRunsList({
  runs,
  title = "Recent ingestion runs",
  description = "Inspect fetch counts, failures, and timestamps from the latest jobs.",
}: {
  runs: AdminIngestionRun[];
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingestion runs yet.</p>
        ) : (
          runs.map((run) => (
            <div
              key={run.id}
              className="rounded-[24px] border border-border/80 bg-white/60 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getRunBadgeVariant(run.status)}>{run.status}</Badge>
                <Badge variant="muted">{run.mode}</Badge>
                <Badge variant="muted">{run.triggerSource}</Badge>
                {run.progress?.warningsCount ? (
                  <Badge variant="highlight">
                    {run.progress.warningsCount} warning{run.progress.warningsCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Started {formatLongDateTime(run.startedAt)}. Fetched {run.fetchedCount}, upserted{" "}
                {run.upsertedCount}, scored {run.scoreCount}, generated {run.summaryCount} executive
                briefs.
              </p>
              {run.progress ? (
                <div className="mt-4 space-y-3">
                  <ProgressBar percent={run.progress.progressPercent} />
                  <p className="text-sm leading-6 text-foreground/90">
                    {run.progress.currentMessage ??
                      `Completed ${getRenderablePhaseTimeline(run.progress).length} tracked ingest phases.`}
                  </p>
                  <div className="space-y-2">
                    {getRenderablePhaseTimeline(run.progress).map((phase) => (
                      <PhaseRow key={`${run.id}-${phase.key}`} phase={phase} />
                    ))}
                  </div>
                </div>
              ) : null}
              {!run.progress && run.logLines.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm leading-6 text-foreground/90">
                  {run.logLines
                    .slice(-4)
                    .map((line, index) => (
                      <li key={`${run.id}-${index}-${line}`}>- {line}</li>
                    ))}
                </ul>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PhaseRow({ phase }: { phase: IngestionPhaseProgress }) {
  const tone =
    phase.status === "completed"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-900"
      : phase.status === "running"
        ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-foreground"
        : phase.status === "failed"
          ? "border-danger/40 bg-danger/10 text-foreground"
          : "border-border/80 bg-white/70 text-muted-foreground";

  return (
    <div className={cn("rounded-2xl border px-3 py-2", tone)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{phase.label}</p>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em]">
          <span>{phase.status}</span>
          {typeof phase.processed === "number" && typeof phase.total === "number" ? (
            <span>{phase.processed}/{phase.total}</span>
          ) : null}
        </div>
      </div>
      {phase.message ? (
        <p className="mt-1 text-sm leading-6 text-current/80">{phase.message}</p>
      ) : null}
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className="h-2 overflow-hidden rounded-full bg-[var(--muted-surface)]"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${Math.max(4, percent)}%` }}
      />
    </div>
  );
}
