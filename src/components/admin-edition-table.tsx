import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { togglePublishedPaperAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getHomepageBriefState,
  hasPdfBackedBrief,
  prioritizePapersWithPdfBackedBriefs,
} from "@/lib/technical/brief-status";
import { cn } from "@/lib/utils/cn";
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
  focusPaperId?: string | null;
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
      usedFallbackAbstract: boolean;
    }>;
  }>;
};

export function AdminEditionTable({
  days,
  selectedDay,
  featuredCount,
  publishedPaperIds,
  focusPaperId,
  papers,
}: AdminEditionTableProps) {
  const publishedSet = new Set(publishedPaperIds);
  const hasCuratedHomepage = publishedPaperIds.length > 0;
  const homePagePaperIds = hasCuratedHomepage
    ? publishedPaperIds
    : prioritizePapersWithPdfBackedBriefs(papers)
        .slice(0, featuredCount)
        .map((paper) => paper.id);
  const homePageSet = new Set(homePagePaperIds);
  const homePageBriefReadyCount = papers.filter(
    (paper) => homePageSet.has(paper.id) && hasPdfBackedBrief(paper.technicalBriefs),
  ).length;
  const homePageMissingBriefCount = Math.max(
    homePagePaperIds.length - homePageBriefReadyCount,
    0,
  );

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
              published edition with explicit homepage and brief status for each row.
            </CardDescription>
          </div>
          {selectedDay ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={hasCuratedHomepage ? "success" : "default"}>
                {hasCuratedHomepage ? "Curated homepage" : "Automatic homepage"}
              </Badge>
              <Badge variant="muted">Scored pool {papers.length}</Badge>
              <Badge variant="muted">Live now {homePagePaperIds.length}</Badge>
              <Badge
                variant={homePageMissingBriefCount === 0 ? "success" : "highlight"}
              >
                PDF briefs ready {homePageBriefReadyCount}/{homePagePaperIds.length}
              </Badge>
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
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {hasCuratedHomepage
                  ? "The homepage is currently using the curated set below. Rows marked 'On homepage now' are live immediately, and their brief badge tells you whether a PDF-backed executive brief is already attached."
                  : `The homepage is currently using the top ${featuredCount} papers automatically, with PDF-backed briefs prioritized first. Publishing any row switches the homepage into curated mode, so the status badges below show exactly what will be live next.`}
              </p>
              {homePageMissingBriefCount > 0 ? (
                <p className="mt-2 text-sm font-medium text-highlight">
                  {homePageMissingBriefCount} homepage paper{homePageMissingBriefCount === 1 ? "" : "s"} still need a PDF-backed executive brief.
                </p>
              ) : (
                <p className="mt-2 text-sm font-medium text-success">
                  Every paper currently visible on the homepage already has a PDF-backed executive brief.
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-3 py-2">Live status</th>
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
                    const briefState = getHomepageBriefState(paper.technicalBriefs);
                    const hasPdfBrief = briefState === "pdf-ready";
                    const isPublished = publishedSet.has(paper.id);
                    const isOnHomepage = homePageSet.has(paper.id);
                    const isAutoHomepagePaper = !hasCuratedHomepage && isOnHomepage;
                    const isFocused = focusPaperId === paper.id;
                    const sourceLabel = hasCuratedHomepage
                      ? isPublished
                        ? "Curated set"
                        : "Not curated"
                      : isAutoHomepagePaper
                        ? "Auto fallback"
                        : "Below fallback cut";
                    const briefLabel = hasPdfBrief
                      ? "PDF brief ready"
                      : briefState === "abstract-fallback"
                        ? "Abstract fallback only"
                        : isOnHomepage
                          ? "PDF brief missing"
                          : "No brief yet";
                    const statusDescription = isOnHomepage
                      ? hasPdfBrief
                        ? "This paper is live on the homepage and its PDF-backed executive brief is already attached."
                        : briefState === "abstract-fallback"
                          ? "This paper is live on the homepage, but the last analysis fell back to the abstract, so the homepage is withholding that brief until PDF extraction succeeds."
                          : "This paper is live on the homepage, but its PDF-backed executive brief is still missing."
                      : hasPdfBrief
                        ? "A PDF-backed brief already exists, but this paper is not currently live on the homepage."
                        : briefState === "abstract-fallback"
                          ? "Only an abstract fallback brief exists so far, so this paper is not homepage-ready yet."
                          : "This paper is stored and scored, but it is not currently live on the homepage.";
                    const actionLabel = hasCuratedHomepage
                      ? isPublished
                        ? "Remove from curated page"
                        : "Add to curated page"
                      : "Start curated homepage";
                    const pendingLabel = isPublished
                      ? "Removing..."
                      : isOnHomepage
                        ? "Publishing and syncing..."
                        : "Publishing...";

                    return (
                      <tr
                        key={paper.id}
                        className={cn(
                          "rounded-[20px] bg-white/70 align-top shadow-sm transition-shadow",
                          isFocused ? "shadow-[0_0_0_2px_rgba(15,127,132,0.22)]" : null,
                        )}
                      >
                        <td className="rounded-l-[20px] px-3 py-4">
                          <div className="flex max-w-[220px] flex-col items-start gap-2">
                            <Badge variant={isOnHomepage ? "success" : "muted"}>
                              {isOnHomepage ? "On homepage now" : "Off homepage"}
                            </Badge>
                            <Badge
                              variant={
                                sourceLabel === "Curated set" || sourceLabel === "Auto fallback"
                                  ? "default"
                                  : "muted"
                              }
                            >
                              {sourceLabel}
                            </Badge>
                            <Badge
                              variant={
                                hasPdfBrief
                                  ? "success"
                                  : briefState === "abstract-fallback"
                                    ? "highlight"
                                    : isOnHomepage
                                      ? "highlight"
                                      : "muted"
                              }
                            >
                              {briefLabel}
                            </Badge>
                            <p className="text-xs leading-5 text-muted-foreground">
                              {statusDescription}
                            </p>
                          </div>
                        </td>
                        <td className="max-w-[420px] px-3 py-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {paper.primaryCategory ? (
                                <Badge variant="muted">{paper.primaryCategory}</Badge>
                              ) : null}
                              {isFocused ? <Badge variant="highlight">Just updated</Badge> : null}
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
                            <div className="rounded-[18px] border border-border/70 bg-background/45 px-3 py-2 text-xs leading-5 text-foreground/80">
                              {paper.technicalBriefs[0]?.oneLineVerdict ??
                                score?.rationale ??
                                "No brief or score rationale is available yet."}
                            </div>
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
                          <form action={togglePublishedPaperAction} className="space-y-2">
                            <input name="announcementDay" type="hidden" value={selectedDay} />
                            <input name="paperId" type="hidden" value={paper.id} />
                            <input
                              name="published"
                              type="hidden"
                              value={isPublished ? "false" : "true"}
                            />
                            <AdminSubmitButton
                              className="w-full"
                              idleLabel={actionLabel}
                              pendingLabel={pendingLabel}
                              size="sm"
                              type="submit"
                              variant={isPublished ? "danger" : isOnHomepage ? "default" : "secondary"}
                            />
                            <p className="text-xs leading-5 text-muted-foreground">
                              {isPublished
                                ? "Removes this paper from the curated homepage set."
                                : hasCuratedHomepage
                                  ? "Adds this paper to the curated homepage set and keeps the current curated mode active."
                                  : "Starts a curated homepage with this paper and triggers PDF-backed brief generation if needed."}
                            </p>
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
