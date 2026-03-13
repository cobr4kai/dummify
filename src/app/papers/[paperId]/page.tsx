import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  regeneratePaperTechnicalBriefAction,
  revertPaperTechnicalBriefAction,
  savePaperTechnicalBriefAction,
} from "@/app/papers/[paperId]/actions";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageShell } from "@/components/page-shell";
import { ScoreBreakdownCard } from "@/components/score-breakdown";
import { TechnicalBriefView } from "@/components/technical-brief-view";
import { isAdminAuthenticated } from "@/lib/auth";
import { ensurePaperEnrichment } from "@/lib/ingestion/service";
import { getRelatedPapers } from "@/lib/related/service";
import { getCurrentScore, getPaperDetail } from "@/lib/search/service";
import { stripTechnicalBriefHeading } from "@/lib/technical/brief-text";
import { isManualTechnicalBriefProvider } from "@/lib/technical/service";
import { formatLongDateTime, formatShortDate } from "@/lib/utils/dates";
import { parseJsonValue } from "@/lib/utils/json";

export const dynamic = "force-dynamic";

const stringArraySchema = z.array(z.string());
const bulletSchema = z.array(
  z.object({
    label: z.string().optional(),
    text: z.string(),
  }),
);
const openAlexSchema = z.object({
  displayName: z.string().nullable().optional(),
  citedByCount: z.number().nullable().optional(),
  topics: z.array(z.string()).optional(),
  relatedWorks: z.array(z.string()).optional(),
});

export default async function PaperDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ paperId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { paperId } = await params;
  const query = await searchParams;

  await ensurePaperEnrichment(paperId);

  const paper = await getPaperDetail(paperId);
  if (!paper) {
    notFound();
  }

  const related = await getRelatedPapers(paperId, 4);
  const score = getCurrentScore(paper.scores);
  const technicalBrief = paper.technicalBriefs[0] ?? null;
  const isAdmin = await isAdminAuthenticated();
  const detailNotice = getPaperDetailNotice(
    typeof query.notice === "string" ? query.notice : null,
  );
  const categories = parseJsonValue(paper.categoriesJson, stringArraySchema, []);
  const adminEditableBullets = parseJsonValue(
    technicalBrief?.bulletsJson ?? [],
    bulletSchema,
    [],
  );
  const editableVerdict = technicalBrief
    ? stripTechnicalBriefHeading(technicalBrief.oneLineVerdict)
    : "";
  const openAlex = paper.enrichments
    .map((enrichment) => parseJsonValue(enrichment.payload, openAlexSchema, {}))
    .find((value) => Object.keys(value).length > 0);
  const pdfCache = paper.pdfCaches[0] ?? null;

  return (
    <PageShell
      currentPath={`/papers/${paper.id}`}
      headerContent={(
        <div>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="highlight">arXiv {paper.arxivId}v{paper.version}</Badge>
                <Badge variant="muted">{formatShortDate(paper.announcementDay)}</Badge>
                {categories.map((category) => (
                  <Badge key={category} variant="muted">
                    {category}
                  </Badge>
                ))}
              </div>
              <h1 className="editorial-title mt-5 text-[2.9rem] text-foreground sm:text-[3.5rem] lg:text-[4rem]">
                {paper.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-foreground/78 sm:text-lg sm:leading-8">
                {paper.authorsText}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:max-w-sm lg:justify-end">
              <Button asChild size="sm" variant="secondary">
                <Link href="/">Back to daily brief</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={paper.abstractUrl} rel="noreferrer" target="_blank">
                  View on arXiv
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      {detailNotice ? (
        <section className="mb-6">
          <Card className={getNoticeCardClassName(detailNotice.variant)}>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant={detailNotice.variant}>Brief editor</Badge>
                  <CardTitle className="mt-3">{detailNotice.title}</CardTitle>
                  <CardDescription className="mt-2 max-w-3xl">
                    {detailNotice.description}
                  </CardDescription>
                </div>
                <Badge variant="muted">{formatShortDate(paper.announcementDay)}</Badge>
              </div>
            </CardHeader>
          </Card>
        </section>
      ) : null}

      <section className="mb-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Paper snapshot</CardTitle>
            <CardDescription>
              Publication timing and current brief availability for this paper.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="stat-panel rounded-[22px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Published
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {formatLongDateTime(paper.publishedAt)}
              </p>
            </div>
            <div className="stat-panel rounded-[22px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Updated
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {formatLongDateTime(paper.updatedAt)}
              </p>
            </div>
            <div className="stat-panel rounded-[22px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Brief status
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {technicalBrief
                  ? technicalBrief.usedFallbackAbstract
                    ? "Abstract-based brief"
                    : "PDF-backed brief"
                  : "Not in the final daily top list yet"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Original abstract</CardTitle>
            <CardDescription>
              PaperBrief briefs are grounded in the official arXiv PDF when available and fall back to the abstract when extraction fails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-foreground/90">{paper.abstract}</p>
          </CardContent>
        </Card>
      </section>

      {technicalBrief ? (
        <section className="mb-6">
          <TechnicalBriefView technicalBrief={technicalBrief} score={score ?? null} />
        </section>
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>No executive brief yet</CardTitle>
            <CardDescription>
              In v1, PaperBrief runs full-PDF analysis only for the final daily brief papers. This paper is still available in the archive and on arXiv.
            </CardDescription>
          </CardHeader>
          {score?.rationale ? (
            <CardContent>
              <div className="stat-panel rounded-[22px] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Scoring note
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground/90">
                  {score.rationale}
                </p>
              </div>
            </CardContent>
          ) : null}
        </Card>
      )}

      {isAdmin && technicalBrief ? (
        <section className="mb-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
                    Admin editor
                  </p>
                  <CardTitle>Edit executive brief</CardTitle>
                  <CardDescription>
                    Make a quick copy edit here without changing routes. Saving updates the live
                    brief, while the editor itself stays visible only to logged-in admins.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{technicalBrief.sourceBasis}</Badge>
                  <Badge variant={technicalBrief.usedFallbackAbstract ? "highlight" : "success"}>
                    {technicalBrief.usedFallbackAbstract ? "Abstract fallback" : "Full PDF"}
                  </Badge>
                  <Badge
                    variant={isManualTechnicalBriefProvider(technicalBrief.provider) ? "highlight" : "muted"}
                  >
                    {isManualTechnicalBriefProvider(technicalBrief.provider)
                      ? "Manual edit live"
                      : "Generated version live"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <form action={savePaperTechnicalBriefAction} className="space-y-4">
                <input name="paperId" type="hidden" value={paper.id} />
                <label className="space-y-2 text-sm font-medium">
                  Why this is worth your attention
                  <Textarea
                    defaultValue={editableVerdict}
                    name="oneLineVerdict"
                    placeholder="Tighten the lead paragraph here"
                  />
                </label>
                <div className="grid gap-4">
                  {Array.from({ length: 5 }, (_, index) => (
                    <label key={index} className="space-y-2 text-sm font-medium">
                      Bullet {index + 1}
                      <Textarea
                        className="min-h-[96px]"
                        defaultValue={adminEditableBullets[index]?.text ?? ""}
                        name="bullet"
                        placeholder={
                          index < 3
                            ? "Required bullet text"
                            : "Optional extra bullet"
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <AdminSubmitButton
                    idleLabel="Save edits"
                    pendingLabel="Saving edits..."
                    type="submit"
                  />
                </div>
              </form>

              <div className="flex flex-wrap gap-3">
                <form action={regeneratePaperTechnicalBriefAction}>
                  <input name="paperId" type="hidden" value={paper.id} />
                  <AdminSubmitButton
                    idleLabel="Regenerate"
                    pendingLabel="Regenerating..."
                    type="submit"
                    variant="secondary"
                  />
                </form>
                <form action={revertPaperTechnicalBriefAction}>
                  <input name="paperId" type="hidden" value={paper.id} />
                  <AdminSubmitButton
                    disabled={!isManualTechnicalBriefProvider(technicalBrief.provider)}
                    idleLabel="Revert to generated"
                    pendingLabel="Reverting..."
                    type="submit"
                    variant="secondary"
                  />
                </form>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        {score ? (
          <ScoreBreakdownCard breakdown={score.breakdown} totalScore={score.totalScore} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Score unavailable</CardTitle>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Source and enrichment status</CardTitle>
            <CardDescription>
              PDF cache status plus optional OpenAlex metadata for this paper.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pdfCache ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="stat-panel rounded-[22px] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Extraction status
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {pdfCache.extractionStatus}
                  </p>
                </div>
                <div className="stat-panel rounded-[22px] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Page count
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {pdfCache.pageCount ?? "n/a"}
                  </p>
                </div>
              </div>
            ) : null}
            {openAlex ? (
              <>
                <div className="stat-panel rounded-[22px] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Citation count
                  </p>
                  <p className="metric-value mt-2 text-3xl text-foreground">
                    {openAlex.citedByCount ?? "n/a"}
                  </p>
                </div>
                {openAlex.topics?.length ? (
                  <div>
                    <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
                      Topic labels
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {openAlex.topics.map((topic) => (
                        <Badge key={topic} variant="default">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm leading-7 text-muted-foreground">
                {pdfCache?.extractionError
                  ? `PDF extraction fell back: ${pdfCache.extractionError}`
                  : "No enrichment data is attached to this paper yet. The app works fully without OpenAlex."}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Related papers</CardTitle>
          <CardDescription>
            Lightweight similarity from shared categories, keyword overlap, recency, and current brief score.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {related.length === 0 ? (
            <p className="text-sm text-muted-foreground">No related papers found yet.</p>
          ) : (
            related.map((item) => (
              <div
                key={item.id}
                className="stat-panel rounded-[24px] p-4"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {item.primaryCategory ?? "Mixed"}
                </p>
                <h3 className="editorial-title mt-2 text-3xl text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.authorsText}
                </p>
                <div className="mt-4 flex gap-3">
                  <Button asChild size="sm">
                    <Link href={`/papers/${item.id}`}>Open</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <a href={item.abstractUrl} rel="noreferrer" target="_blank">
                      arXiv
                    </a>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

type PaperDetailNotice = {
  title: string;
  description: string;
  variant: "success" | "highlight" | "danger";
} | null;

function getPaperDetailNotice(notice: string | null): PaperDetailNotice {
  switch (notice) {
    case "brief-saved":
      return {
        title: "Manual edits saved",
        description:
          "The current executive brief now uses your edited copy. You can still regenerate or revert later.",
        variant: "success",
      };
    case "brief-regenerated":
      return {
        title: "Brief regenerated",
        description:
          "A fresh generated version is now live for this paper.",
        variant: "success",
      };
    case "brief-reverted":
      return {
        title: "Reverted to generated copy",
        description:
          "The latest generated executive brief is live again.",
        variant: "success",
      };
    case "brief-invalid":
      return {
        title: "Could not save edits",
        description:
          "Please keep the lead paragraph reasonably complete and include 3 to 5 non-empty bullets.",
        variant: "danger",
      };
    case "brief-pdf-required":
      return {
        title: "Regeneration needs the PDF",
        description:
          "The current brief expects full-PDF regeneration, but PDF extraction was unavailable for this paper.",
        variant: "highlight",
      };
    case "brief-revert-unavailable":
      return {
        title: "Nothing to revert",
        description:
          "There is no earlier generated brief version available to restore for this paper.",
        variant: "highlight",
      };
    case "brief-regenerate-unavailable":
      return {
        title: "Could not regenerate brief",
        description:
          "The provider or source material was unavailable, so the brief was left unchanged.",
        variant: "highlight",
      };
    default:
      return null;
  }
}

function getNoticeCardClassName(variant: NonNullable<PaperDetailNotice>["variant"]) {
  switch (variant) {
    case "success":
      return "notice-success";
    case "highlight":
      return "notice-highlight";
    case "danger":
      return "notice-danger";
  }
}
