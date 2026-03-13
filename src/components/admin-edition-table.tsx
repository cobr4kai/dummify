"use client";

import Link from "next/link";
import { useState } from "react";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { togglePublishedPaperAction } from "@/app/admin/actions";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  executiveScoreBreakdownRecordSchema,
  normalizeExecutiveScoreBreakdown,
} from "@/lib/scoring/model";
import {
  getHomepageBriefState,
  hasPdfBackedBrief,
} from "@/lib/technical/brief-status";
import type { ExecutiveScoreComponentKey } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatShortDate } from "@/lib/utils/dates";
import { parseJsonValue } from "@/lib/utils/json";

const scoreColumns = [
  { key: "frontierRelevance", label: "Frontier" },
  { key: "capabilityImpact", label: "Capability" },
  { key: "realWorldImpact", label: "Real-world" },
  { key: "evidenceStrength", label: "Evidence" },
  { key: "audiencePull", label: "Audience" },
] as const satisfies ReadonlyArray<{
  key: ExecutiveScoreComponentKey;
  label: string;
}>;

type AdminEditionSortKey = "liveStatus" | "paper" | "total" | ExecutiveScoreComponentKey;
type AdminEditionSortDirection = "asc" | "desc";
type ScoreBreakdownRecord = z.infer<typeof executiveScoreBreakdownRecordSchema>;

type AdminEditionTableProps = {
  days: string[];
  selectedDay: string | null;
  activeHomepageAnnouncementDay?: string | null;
  publishedPaperIds: string[];
  focusPaperId?: string | null;
  sortKey?: string | null;
  sortDirection?: string | null;
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

type AdminEditionPaper = AdminEditionTableProps["papers"][number];
type AdminEditionRow = {
  paper: AdminEditionPaper;
  score: AdminEditionPaper["scores"][number] | undefined;
  breakdown: ScoreBreakdownRecord;
  briefState: ReturnType<typeof getHomepageBriefState>;
  hasPdfBrief: boolean;
  isPublished: boolean;
  isOnHomepage: boolean;
  isFocused: boolean;
  sourceLabel: string;
  briefLabel: string;
  actionLabel: string;
  pendingLabel: string;
  liveStatusRank: number;
  totalScore: number;
};

export function AdminEditionTable({
  days,
  selectedDay,
  activeHomepageAnnouncementDay,
  publishedPaperIds,
  focusPaperId,
  sortKey,
  sortDirection,
  papers,
}: AdminEditionTableProps) {
  const publishedSet = new Set(publishedPaperIds);
  const hasCuratedHomepage = publishedPaperIds.length > 0;
  const homePagePaperIds = publishedPaperIds;
  const homePageSet = new Set(homePagePaperIds);
  const homePageBriefReadyCount = papers.filter(
    (paper) => homePageSet.has(paper.id) && hasPdfBackedBrief(paper.technicalBriefs),
  ).length;
  const homePageMissingBriefCount = Math.max(
    homePagePaperIds.length - homePageBriefReadyCount,
    0,
  );
  const isActiveHomepageDay = Boolean(
    selectedDay &&
    activeHomepageAnnouncementDay &&
    selectedDay === activeHomepageAnnouncementDay,
  );
  const initialSortKey = readSortKey(sortKey);
  const initialSortDirection = readSortDirection(sortDirection, initialSortKey);
  const [currentSortKey, setCurrentSortKey] = useState<AdminEditionSortKey>(initialSortKey);
  const [currentSortDirection, setCurrentSortDirection] = useState<AdminEditionSortDirection>(
    initialSortDirection,
  );
  const rows = papers.map((paper) => buildRow({
    paper,
    focusPaperId,
    hasCuratedHomepage,
    homePageSet,
    publishedSet,
  }));
  const sortedRows = [...rows].sort((left, right) =>
    compareRows(left, right, currentSortKey, currentSortDirection),
  );
  const activeSortLabel = getSortLabel(currentSortKey);
  const statusColumnLabel = isActiveHomepageDay ? "Live status" : "Edition status";

  function handleSort(requestedSortKey: AdminEditionSortKey) {
    const nextSortDirection = getNextSortDirection(
      currentSortKey,
      currentSortDirection,
      requestedSortKey,
    );

    setCurrentSortKey(requestedSortKey);
    setCurrentSortDirection(nextSortDirection);
    replaceAdminSortUrl({
      selectedDay,
      sortDirection: nextSortDirection,
      sortKey: requestedSortKey,
    });
  }

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
              selected edition. Nothing goes live until you explicitly add papers, and changes only
              affect the public homepage immediately when this day matches the active homepage day.
            </CardDescription>
          </div>
          {selectedDay ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={hasCuratedHomepage ? "success" : "muted"}>
                {isActiveHomepageDay
                  ? hasCuratedHomepage
                    ? "Curated homepage"
                    : "Homepage empty"
                  : hasCuratedHomepage
                    ? "Curated preview"
                    : "Nothing selected"}
              </Badge>
              <Badge variant="muted">Scored pool {papers.length}</Badge>
              <Badge variant="muted">
                {isActiveHomepageDay ? "Live now" : "Selected"} {homePagePaperIds.length}
              </Badge>
              <Badge
                variant={homePageMissingBriefCount === 0 ? "success" : "highlight"}
              >
                PDF briefs ready {homePageBriefReadyCount}/{homePagePaperIds.length}
              </Badge>
              {!isActiveHomepageDay && activeHomepageAnnouncementDay ? (
                <Badge variant="highlight">
                  Active day {formatShortDate(activeHomepageAnnouncementDay)}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        <form className="flex flex-wrap items-end gap-3">
          <SortStateInputs
            sortDirection={currentSortDirection}
            sortKey={currentSortKey}
          />
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
            Ingest papers first, then come back here to curate a published edition.
          </p>
        ) : papers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no papers stored for {formatShortDate(selectedDay)} yet.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {isActiveHomepageDay
                  ? hasCuratedHomepage
                    ? "The homepage is currently using the curated set below. Rows marked 'On homepage now' are live immediately, and their brief badge tells you whether a PDF-backed executive brief is already attached."
                    : "This is the active homepage day, but nothing is live yet because no curated papers have been selected."
                  : hasCuratedHomepage
                    ? "This selected day already has a curated set saved. You are editing that saved edition, but it is not currently live on the homepage."
                    : "This selected day has no curated set yet. Use the action buttons below to choose exactly which papers should go live when you are ready."}
              </p>
              {homePageMissingBriefCount > 0 ? (
                <p className="mt-2 text-sm font-medium text-highlight">
                  {homePageMissingBriefCount} selected paper{homePageMissingBriefCount === 1 ? "" : "s"} still need a PDF-backed executive brief.
                </p>
              ) : homePagePaperIds.length > 0 ? (
                <p className="mt-2 text-sm font-medium text-success">
                  Every selected paper already has a PDF-backed executive brief.
                </p>
              ) : (
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  No papers are selected for this day yet.
                </p>
              )}
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Click any column heading to sort. Active sort: {activeSortLabel} ({formatSortDirectionLabel(currentSortKey, currentSortDirection)}).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <SortableHeader
                      currentSortDirection={currentSortDirection}
                      currentSortKey={currentSortKey}
                      label={statusColumnLabel}
                      onSort={handleSort}
                      requestedSortKey="liveStatus"
                    />
                    <SortableHeader
                      currentSortDirection={currentSortDirection}
                      currentSortKey={currentSortKey}
                      label="Paper"
                      onSort={handleSort}
                      requestedSortKey="paper"
                    />
                    <SortableHeader
                      currentSortDirection={currentSortDirection}
                      currentSortKey={currentSortKey}
                      label="Total"
                      onSort={handleSort}
                      requestedSortKey="total"
                    />
                    {scoreColumns.map((column) => (
                      <SortableHeader
                        key={column.key}
                        currentSortDirection={currentSortDirection}
                        currentSortKey={currentSortKey}
                        label={column.label}
                        onSort={handleSort}
                        requestedSortKey={column.key}
                      />
                    ))}
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.paper.id}
                      className={cn(
                        "rounded-[20px] bg-white/70 align-top shadow-sm transition-shadow",
                        row.isFocused ? "shadow-[0_0_0_2px_rgba(15,127,132,0.22)]" : null,
                      )}
                    >
                      <td className="rounded-l-[20px] px-3 py-4">
                        <div className="flex max-w-[220px] flex-col items-start gap-2">
                          <Badge variant={row.isOnHomepage ? "success" : "muted"}>
                            {row.isOnHomepage
                              ? isActiveHomepageDay
                                ? "On homepage now"
                                : "In selected edition"
                              : isActiveHomepageDay
                                ? "Off homepage"
                                : "Outside selected edition"}
                          </Badge>
                          <Badge
                            variant={
                              row.sourceLabel === "Curated set" || row.sourceLabel === "Auto fallback"
                                ? "default"
                                : "muted"
                            }
                          >
                            {row.sourceLabel}
                          </Badge>
                          <Badge
                            variant={
                              row.hasPdfBrief
                                ? "success"
                                : row.briefState === "abstract-fallback"
                                  ? "highlight"
                                  : row.isOnHomepage
                                    ? "highlight"
                                    : "muted"
                            }
                          >
                            {row.briefLabel}
                          </Badge>
                        </div>
                      </td>
                      <td className="max-w-[420px] px-3 py-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.paper.primaryCategory ? (
                              <Badge variant="muted">{row.paper.primaryCategory}</Badge>
                            ) : null}
                            {row.isFocused ? <Badge variant="highlight">Just updated</Badge> : null}
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/papers/${row.paper.id}`}>Open detail</Link>
                            </Button>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{row.paper.title}</p>
                          </div>
                          <a
                            href={row.paper.abstractUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block text-xs font-medium text-foreground/75 underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Open arXiv abstract
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-4 font-semibold text-foreground">
                        {formatScore(row.totalScore)}
                      </td>
                      {scoreColumns.map((column) => (
                        <td key={column.key} className="px-3 py-4 text-foreground/85">
                          {formatScore(row.breakdown[column.key]?.rawScore)}
                        </td>
                      ))}
                      <td className="rounded-r-[20px] px-3 py-4">
                        <form action={togglePublishedPaperAction}>
                          <SortStateInputs
                            sortDirection={currentSortDirection}
                            sortKey={currentSortKey}
                          />
                          <input name="announcementDay" type="hidden" value={selectedDay} />
                          <input name="paperId" type="hidden" value={row.paper.id} />
                          <input
                            name="published"
                            type="hidden"
                            value={row.isPublished ? "false" : "true"}
                          />
                          <AdminSubmitButton
                            className="w-full"
                            idleLabel={row.actionLabel}
                            pendingLabel={row.pendingLabel}
                            size="sm"
                            type="submit"
                            variant={
                              row.isPublished
                                ? "danger"
                                : row.isOnHomepage
                                  ? "default"
                                  : "secondary"
                            }
                          />
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SortStateInputs({
  sortKey,
  sortDirection,
}: {
  sortKey: AdminEditionSortKey;
  sortDirection: AdminEditionSortDirection;
}) {
  return (
    <>
      <input name="sort" type="hidden" value={sortKey} />
      <input name="dir" type="hidden" value={sortDirection} />
    </>
  );
}

function SortableHeader({
  currentSortKey,
  currentSortDirection,
  requestedSortKey,
  label,
  onSort,
}: {
  currentSortKey: AdminEditionSortKey;
  currentSortDirection: AdminEditionSortDirection;
  requestedSortKey: AdminEditionSortKey;
  label: string;
  onSort: (requestedSortKey: AdminEditionSortKey) => void;
}) {
  const isActive = currentSortKey === requestedSortKey;

  return (
    <th
      aria-sort={
        isActive
          ? currentSortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className="px-3 py-2"
    >
      <button
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-foreground/5 hover:text-foreground",
          isActive ? "text-foreground" : null,
        )}
        onClick={() => onSort(requestedSortKey)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden>{isActive ? (currentSortDirection === "asc" ? "^" : "v") : "<>"}</span>
      </button>
    </th>
  );
}

function replaceAdminSortUrl(input: {
  selectedDay: string | null;
  sortKey: AdminEditionSortKey;
  sortDirection: AdminEditionSortDirection;
}) {
  const params = new URLSearchParams(window.location.search);

  if (input.selectedDay) {
    params.set("day", input.selectedDay);
  } else {
    params.delete("day");
  }

  params.set("sort", input.sortKey);
  params.set("dir", input.sortDirection);

  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function buildRow(input: {
  paper: AdminEditionPaper;
  focusPaperId?: string | null;
  hasCuratedHomepage: boolean;
  homePageSet: Set<string>;
  publishedSet: Set<string>;
}): AdminEditionRow {
  const score = input.paper.scores[0];
  const breakdown = normalizeExecutiveScoreBreakdown(
    parseJsonValue(score?.breakdown ?? {}, executiveScoreBreakdownRecordSchema, {}),
  );
  const briefState = getHomepageBriefState(input.paper.technicalBriefs);
  const hasPdfBrief = briefState === "pdf-ready";
  const isPublished = input.publishedSet.has(input.paper.id);
  const isOnHomepage = input.homePageSet.has(input.paper.id);
  const isFocused = input.focusPaperId === input.paper.id;
  const sourceLabel = input.hasCuratedHomepage
    ? isPublished
      ? "Curated set"
      : "Not curated"
    : "Not selected";
  const briefLabel = hasPdfBrief
    ? "PDF brief ready"
    : briefState === "abstract-fallback"
      ? "Abstract fallback only"
      : isOnHomepage
        ? "PDF brief missing"
        : "No brief yet";
  const actionLabel = input.hasCuratedHomepage
    ? isPublished
      ? "Remove from curated set"
      : "Add to curated set"
    : "Create curated set";
  const pendingLabel = isPublished ? "Removing..." : "Saving...";
  const liveStatusRank =
    (isOnHomepage ? 100 : 0) +
    (hasPdfBrief ? 20 : briefState === "abstract-fallback" ? 10 : 0) +
    (isPublished ? 5 : 0);

  return {
    paper: input.paper,
    score,
    breakdown,
    briefState,
    hasPdfBrief,
    isPublished,
    isOnHomepage,
    isFocused,
    sourceLabel,
    briefLabel,
    actionLabel,
    pendingLabel,
    liveStatusRank,
    totalScore: score?.totalScore ?? -1,
  };
}

function compareRows(
  left: AdminEditionRow,
  right: AdminEditionRow,
  sortKey: AdminEditionSortKey,
  sortDirection: AdminEditionSortDirection,
) {
  const primaryResult = comparePrimary(left, right, sortKey);
  const directedResult = sortDirection === "asc" ? primaryResult : primaryResult * -1;
  if (directedResult !== 0) {
    return directedResult;
  }

  const totalTieBreaker = compareNumber(right.totalScore, left.totalScore);
  if (totalTieBreaker !== 0) {
    return totalTieBreaker;
  }

  return left.paper.title.localeCompare(right.paper.title);
}

function comparePrimary(
  left: AdminEditionRow,
  right: AdminEditionRow,
  sortKey: AdminEditionSortKey,
) {
  switch (sortKey) {
    case "liveStatus":
      return compareNumber(left.liveStatusRank, right.liveStatusRank);
    case "paper":
      return left.paper.title.localeCompare(right.paper.title);
    case "total":
      return compareNumber(left.totalScore, right.totalScore);
    default:
      return compareNumber(
        left.breakdown[sortKey]?.rawScore ?? -1,
        right.breakdown[sortKey]?.rawScore ?? -1,
      );
  }
}

function compareNumber(left: number, right: number) {
  if (left === right) {
    return 0;
  }

  return left > right ? 1 : -1;
}

function readSortKey(value: string | null | undefined): AdminEditionSortKey {
  if (value === "liveStatus" || value === "paper" || value === "total") {
    return value;
  }

  const scoreColumn = scoreColumns.find((column) => column.key === value);
  return scoreColumn?.key ?? "total";
}

function readSortDirection(
  value: string | null | undefined,
  sortKey: AdminEditionSortKey,
): AdminEditionSortDirection {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return getDefaultSortDirection(sortKey);
}

function getDefaultSortDirection(sortKey: AdminEditionSortKey): AdminEditionSortDirection {
  return sortKey === "paper" ? "asc" : "desc";
}

function getNextSortDirection(
  currentSortKey: AdminEditionSortKey,
  currentSortDirection: AdminEditionSortDirection,
  requestedSortKey: AdminEditionSortKey,
): AdminEditionSortDirection {
  if (currentSortKey === requestedSortKey) {
    return currentSortDirection === "asc" ? "desc" : "asc";
  }

  return getDefaultSortDirection(requestedSortKey);
}

function getSortLabel(sortKey: AdminEditionSortKey) {
  if (sortKey === "liveStatus") {
    return "live status";
  }

  if (sortKey === "paper") {
    return "paper title";
  }

  if (sortKey === "total") {
    return "total score";
  }

  return scoreColumns.find((column) => column.key === sortKey)?.label.toLowerCase() ?? "total score";
}

function formatSortDirectionLabel(
  sortKey: AdminEditionSortKey,
  sortDirection: AdminEditionSortDirection,
) {
  if (sortKey === "paper") {
    return sortDirection === "asc" ? "A to Z" : "Z to A";
  }

  return sortDirection === "asc" ? "low to high" : "high to low";
}

function formatScore(value: number | undefined) {
  if (typeof value !== "number" || value < 0) {
    return "-";
  }

  return value.toFixed(1);
}
