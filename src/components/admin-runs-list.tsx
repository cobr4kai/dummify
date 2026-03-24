import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRunBadgeVariant } from "@/lib/admin/ui";
import { formatLongDateTime } from "@/lib/utils/dates";

export function AdminRunsList({
  runs,
  title = "Recent ingestion runs",
  description = "Inspect fetch counts, failures, and timestamps from the latest jobs.",
}: {
  runs: Array<{
    id: string;
    status: string;
    mode: string;
    triggerSource: string;
    startedAt: Date;
    fetchedCount: number;
    upsertedCount: number;
    scoreCount: number;
    summaryCount: number;
    logLines: unknown;
  }>;
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
          runs.map((run) => {
            const logLines = Array.isArray(run.logLines)
              ? run.logLines.filter((line): line is string | number | boolean => line !== null)
              : [];
            const hasWarnings = logLines.some((line) => {
              const text = String(line).toLowerCase();
              return text.includes("warning") || text.includes("fell back to deterministic-only");
            });

            return (
              <div
                key={run.id}
                className="rounded-[24px] border border-border/80 bg-white/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getRunBadgeVariant(run.status)}>{run.status}</Badge>
                  <Badge variant="muted">{run.mode}</Badge>
                  <Badge variant="muted">{run.triggerSource}</Badge>
                  {hasWarnings ? <Badge variant="highlight">Warnings</Badge> : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Started {formatLongDateTime(run.startedAt)}. Fetched {run.fetchedCount}, upserted{" "}
                  {run.upsertedCount}, scored {run.scoreCount}, generated {run.summaryCount} executive
                  briefs.
                  {hasWarnings ? " Completed with warnings." : ""}
                </p>
                {logLines.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm leading-6 text-foreground/90">
                    {logLines
                      .slice(-4)
                      .map((line, index) => (
                        <li key={`${run.id}-${index}-${String(line)}`}>- {String(line)}</li>
                      ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
