import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { togglePublishedPaperAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate } from "@/lib/utils/dates";
import { parseJsonValue } from "@/lib/utils/json";

const breakdownSchema = z.record(
  z.string(),
  z.object({
    key: z.string(),
    label: z.string(),
    rawScore: z.number(),
    weight: z.number(),
    weightedScore: z.number(),
    reason: z.string(),
  }),
);

const scoreColumns = [
  { key: "frontierRelevance", label: "Frontier" },
  { key: "capabilityImpact", label: "Capability" },
  { key: "trainingEconomicsImpact", label: "Training" },
  { key: "inferenceEconomicsImpact", label: "Inference" },
  { key: "platformStackImpact", label: "Platform" },
  { key: "strategicBusinessImpact", label: "Strategic" },
  { key: "evidenceStrength", label: "Evidence" },
  { key: "claritySignal", label: "Clarity" },
] as const;

type AdminEditionTableProps = {
  days: string[];
  selectedDay: string | null;
  featuredCount: number;
  publishedPaperIds: string[];
  papers: Array<{
    id: string;
    title: string;
    authorsText: string;
    abstractUrl: string;
    primaryCategory: string | null;
    scores: Array<{
      totalScore: number;
      rationale: string;
      breakdown: Prisma.JsonValue;
    }>;
    technicalBriefs: Array<{
      oneLineVerdict: string;
    }>;
  }>;
};

export function AdminEditionTable({
  days,
  selectedDay,
  featuredCount,
  publishedPaperIds,
  papers,
}: AdminEditionTableProps) {
  const publishedSet = new Set(publishedPaperIds);

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
              Edition editor
            </p>
            <CardTitle>Curate the published front page</CardTitle>
            <CardDescription>
              Review one announcement day as a score table, then add or remove papers from the
              published edition without touching code.
            </CardDescription>
          </div>
          {selectedDay ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Published {publishedPaperIds.length}</Badge>
              <Badge variant="muted">Scored pool {papers.length}</Badge>
              <Badge variant="muted">Auto fallback {featuredCount}</Badge>
            </div>
          ) : null}
        </div>

        <form className="flex flex-wrap items-end gap-3">
          <label className="space-y-2 text-sm font-medium">
            Announcement day
            <select
              className="h-11 min-w-[220px] rounded-2xl border border-border bg-white/70 px-4 text-sm"
              defaultValue={selectedDay ?? ""}
              name="day"
            >
              {days.length === 0 ? <option value="">No days yet</option> : null}
              {days.map((day) => (
                <option key={day} value={day}>
                  {formatShortDate(day)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Load score table</Button>
        </form>
      </CardHeader>
      <CardContent>
        {!selectedDay ? (
          <p className="text-sm text-muted-foreground">
            Ingest or seed papers first, then come back here to curate a published edition.
          </p>
        ) : papers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no papers stored for {formatShortDate(selectedDay)} yet.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              When at least one paper is published for this day, the front page uses that curated
              set. If you remove them all, the home page falls back to the top {featuredCount} by
              score.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1380px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2">Paper</th>
                    <th className="px-3 py-2">Total</th>
                    {scoreColumns.map((column) => (
                      <th key={column.key} className="px-3 py-2">
                        {column.label}
                      </th>
                    ))}
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {papers.map((paper) => {
                    const score = paper.scores[0];
                    const breakdown = parseJsonValue(score?.breakdown ?? {}, breakdownSchema, {});
                    const isPublished = publishedSet.has(paper.id);

                    return (
                      <tr key={paper.id} className="rounded-[20px] bg-white/70 align-top">
                        <td className="rounded-l-[20px] px-3 py-4">
                          <Badge variant={isPublished ? "success" : "muted"}>
                            {isPublished ? "Published" : "Draft"}
                          </Badge>
                        </td>
                        <td className="max-w-[420px] px-3 py-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {paper.primaryCategory ? (
                                <Badge variant="muted">{paper.primaryCategory}</Badge>
                              ) : null}
                              <Button asChild size="sm" variant="ghost">
                                <Link href={`/papers/${paper.id}`}>Open detail</Link>
                              </Button>
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{paper.title}</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {paper.authorsText}
                              </p>
                            </div>
                            <p className="text-xs leading-5 text-foreground/80">
                              {paper.technicalBriefs[0]?.oneLineVerdict ?? score?.rationale ?? "No brief yet."}
                            </p>
                            <a
                              href={paper.abstractUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block text-xs font-medium text-foreground/75 underline-offset-4 hover:text-foreground hover:underline"
                            >
                              Open arXiv abstract
                            </a>
                          </div>
                        </td>
                        <td className="px-3 py-4 font-semibold text-foreground">
                          {formatScore(score?.totalScore)}
                        </td>
                        {scoreColumns.map((column) => (
                          <td key={column.key} className="px-3 py-4 text-foreground/85">
                            {formatScore(breakdown[column.key]?.rawScore)}
                          </td>
                        ))}
                        <td className="rounded-r-[20px] px-3 py-4">
                          <form action={togglePublishedPaperAction}>
                            <input name="announcementDay" type="hidden" value={selectedDay} />
                            <input name="paperId" type="hidden" value={paper.id} />
                            <input
                              name="published"
                              type="hidden"
                              value={isPublished ? "false" : "true"}
                            />
                            <Button
                              size="sm"
                              type="submit"
                              variant={isPublished ? "danger" : "secondary"}
                            >
                              {isPublished ? "Remove from page" : "Add to page"}
                            </Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatScore(value: number | undefined) {
  if (typeof value !== "number") {
    return "-";
  }

  return value.toFixed(1);
}
