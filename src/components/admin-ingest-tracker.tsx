"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRunBadgeVariant } from "@/lib/admin/ui";
import { type AdminIngestionRun, getRenderablePhaseTimeline } from "@/lib/ingestion/progress";
import { formatLongDateTime } from "@/lib/utils/dates";
import { AdminRunsList, ProgressBar } from "@/components/admin-runs-list";

const POLL_INTERVAL_MS = 4000;

export function AdminIngestTracker({
  initialActiveRun,
  initialRuns,
}: {
  initialActiveRun: AdminIngestionRun | null;
  initialRuns: AdminIngestionRun[];
}) {
  const [activeRun, setActiveRun] = useState(initialActiveRun);
  const [recentRuns, setRecentRuns] = useState(initialRuns);

  useEffect(() => {
    if (!activeRun) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/admin/ingest-status", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          return;
        }

        const nextStatus = (await response.json()) as {
          activeRun: AdminIngestionRun | null;
          recentRuns: AdminIngestionRun[];
        };

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setActiveRun(nextStatus.activeRun);
          setRecentRuns(nextStatus.recentRuns);
        });
      } catch {
        // Keep the last known status on transient polling failures.
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeRun?.id]);

  const recentRunsDescription = useMemo(() => {
    return activeRun
      ? "Older completed and partial runs stay here while the active run updates above."
      : "Inspect fetch counts, failures, and timestamps from the latest jobs.";
  }, [activeRun]);

  return (
    <div className="space-y-6">
      {activeRun ? <ActiveIngestRunCard run={activeRun} /> : null}
      <AdminRunsList
        description={recentRunsDescription}
        runs={recentRuns}
        title={activeRun ? "Recent completed runs" : "Recent ingestion runs"}
      />
    </div>
  );
}

function ActiveIngestRunCard({ run }: { run: AdminIngestionRun }) {
  const phases = getRenderablePhaseTimeline(run.progress);

  return (
    <Card className="notice-highlight">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant={getRunBadgeVariant(run.status)}>Active run</Badge>
            <CardTitle className="mt-3">Ingest in progress</CardTitle>
            <CardDescription className="mt-2 max-w-3xl">
              Started {formatLongDateTime(run.startedAt)}. The tracker refreshes every few
              seconds while this run is active.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{run.mode}</Badge>
            <Badge variant="muted">{run.triggerSource}</Badge>
            {run.progress?.warningsCount ? (
              <Badge variant="highlight">
                {run.progress.warningsCount} warning{run.progress.warningsCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[24px] border border-border/80 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Current step
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {run.progress?.currentMessage ?? "Working through ingest tasks."}
              </p>
            </div>
            <Badge variant="muted">
              Last updated{" "}
              {run.progress?.lastHeartbeatAt
                ? formatLongDateTime(run.progress.lastHeartbeatAt)
                : formatLongDateTime(run.startedAt)}
            </Badge>
          </div>
          <div className="mt-4">
            <ProgressBar percent={run.progress?.progressPercent ?? 0} />
            <p className="mt-2 text-sm text-muted-foreground">
              {run.progress?.progressPercent ?? 0}% complete
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {phases.map((phase) => (
            <div
              key={`${run.id}-${phase.key}`}
              className="rounded-[22px] border border-border/80 bg-white/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{phase.label}</p>
                  {phase.message ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {phase.message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={phase.status === "completed" ? "success" : "highlight"}>
                    {phase.status}
                  </Badge>
                  {typeof phase.processed === "number" && typeof phase.total === "number" ? (
                    <Badge variant="muted">
                      {phase.processed}/{phase.total}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
