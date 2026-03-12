import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { ScoreBreakdownCard } from "@/components/score-breakdown";
import { TechnicalBriefView } from "@/components/technical-brief-view";
import { ensurePaperEnrichment } from "@/lib/ingestion/service";
import { getRelatedPapers } from "@/lib/related/service";
import { getCurrentScore, getPaperDetail } from "@/lib/search/service";
import { formatLongDateTime, formatShortDate } from "@/lib/utils/dates";
import { parseJsonValue } from "@/lib/utils/json";

export const dynamic = "force-dynamic";

const stringArraySchema = z.array(z.string());
const openAlexSchema = z.object({
  displayName: z.string().nullable().optional(),
  citedByCount: z.number().nullable().optional(),
  topics: z.array(z.string()).optional(),
  relatedWorks: z.array(z.string()).optional(),
});

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;

  await ensurePaperEnrichment(paperId);

  const paper = await getPaperDetail(paperId);
  if (!paper) {
    notFound();
  }

  const related = await getRelatedPapers(paperId, 4);
  const score = getCurrentScore(paper.scores);
  const technicalBrief = paper.technicalBriefs[0] ?? null;
  const categories = parseJsonValue(paper.categoriesJson, stringArraySchema, []);
  const openAlex = paper.enrichments
    .map((enrichment) => parseJsonValue(enrichment.payload, openAlexSchema, {}))
    .find((value) => Object.keys(value).length > 0);
  const pdfCache = paper.pdfCaches[0] ?? null;

  return (
    <PageShell currentPath={`/papers/${paper.id}`}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant="secondary">
          <Link href="/">Back to daily brief</Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <a href={paper.abstractUrl} rel="noreferrer" target="_blank">
            View on arXiv
          </a>
        </Button>
        {paper.pdfUrl ? (
          <Button asChild size="sm" variant="secondary">
            <a href={paper.pdfUrl} rel="noreferrer" target="_blank">
              Official PDF
            </a>
          </Button>
        ) : null}
      </div>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="highlight">arXiv {paper.arxivId}v{paper.version}</Badge>
              <Badge variant="muted">{formatShortDate(paper.announcementDay)}</Badge>
              {categories.map((category) => (
                <Badge key={category} variant="muted">
                  {category}
                </Badge>
              ))}
            </div>
            <CardTitle>{paper.title}</CardTitle>
            <CardDescription>{paper.authorsText}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[22px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Published
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {formatLongDateTime(paper.publishedAt)}
              </p>
            </div>
            <div className="rounded-[22px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Updated
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {formatLongDateTime(paper.updatedAt)}
              </p>
            </div>
            <div className="rounded-[22px] border border-border/80 bg-white/60 p-4">
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
        </Card>
      )}

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
                <div className="rounded-[22px] border border-border/80 bg-white/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Extraction status
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {pdfCache.extractionStatus}
                  </p>
                </div>
                <div className="rounded-[22px] border border-border/80 bg-white/60 p-4">
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
                <div className="rounded-[22px] border border-border/80 bg-white/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Citation count
                  </p>
                  <p className="mt-2 font-serif text-3xl">
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
                className="rounded-[24px] border border-border/80 bg-white/60 p-4"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {item.primaryCategory ?? "Mixed"}
                </p>
                <h3 className="mt-2 font-serif text-2xl leading-tight">{item.title}</h3>
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
