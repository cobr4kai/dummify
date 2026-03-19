import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { z } from "zod";
import {
  regeneratePaperTechnicalBriefAction,
  revertPaperTechnicalBriefAction,
  savePaperTechnicalBriefAction,
} from "@/app/papers/[paperId]/actions";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { PageShell } from "@/components/page-shell";
import { TechnicalBriefView } from "@/components/technical-brief-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  getBriefMetaDescription,
  getBriefPath,
  getBriefSlug,
  getPaperLastModified,
  getPublicBriefBySlug,
  getWeekPath,
} from "@/lib/briefs";
import { isAdminAuthenticated } from "@/lib/auth";
import { getRelatedPapers } from "@/lib/related/service";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildPageMetadata,
} from "@/lib/seo";
import { isManualTechnicalBriefProvider } from "@/lib/technical/service";
import { stripTechnicalBriefHeading } from "@/lib/technical/brief-text";
import { formatLongDateTime, formatShortDate, getWeekStart } from "@/lib/utils/dates";
import { parseJsonValue } from "@/lib/utils/json";
import { formatDisplayAuthors } from "@/lib/utils/strings";

export const dynamic = "force-dynamic";

const bulletSchema = z.array(
  z.object({
    label: z.string().optional(),
    text: z.string(),
  }),
);

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ notice?: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const paper = await getPublicBriefBySlug(slug);

  if (!paper) {
    return buildPageMetadata({
      path: `/briefs/${slug}`,
      title: "Brief not found | Abstracted",
      description: "This brief is not available.",
      noIndex: true,
    });
  }

  return buildPageMetadata({
    path: getBriefPath(paper),
    title: `${paper.title} explained | Abstracted`,
    description: getBriefMetaDescription(paper.title),
    type: "article",
  });
}

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const paper = await getPublicBriefBySlug(slug);

  if (!paper) {
    notFound();
  }

  const canonicalSlug = getBriefSlug(paper);
  if (slug !== canonicalSlug) {
    permanentRedirect(getBriefPath(paper));
  }

  const technicalBrief = paper.technicalBriefs[0];
  if (!technicalBrief) {
    notFound();
  }

  const score = paper.scores[0] ?? null;
  const weekStart = getWeekStart(paper.announcementDay);
  const weekHref = getWeekPath(weekStart);
  const related = await getRelatedPapers(paper.id, 4);
  const isAdmin = await isAdminAuthenticated();
  const detailNotice = getPaperDetailNotice(
    typeof query.notice === "string" ? query.notice : null,
  );
  const adminEditableBullets = parseJsonValue(
    technicalBrief.bulletsJson ?? [],
    bulletSchema,
    [],
  );
  const editableVerdict = stripTechnicalBriefHeading(technicalBrief.oneLineVerdict);
  const displayAuthorsText = formatDisplayAuthors(paper.authorsText);
  const description = getBriefMetaDescription(paper.title);

  return (
    <PageShell
      currentPath={getBriefPath(paper)}
      headerContent={(
        <div>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="highlight">arXiv {paper.arxivId}v{paper.version}</Badge>
                <Badge variant="muted">{formatShortDate(paper.announcementDay)}</Badge>
              </div>
              <h1 className="editorial-title mt-5 text-[2.9rem] text-foreground sm:text-[3.5rem] lg:text-[4rem]">
                {paper.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {displayAuthorsText}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:max-w-sm lg:justify-end">
              <Button asChild size="sm" variant="secondary">
                <Link href={weekHref}>Back to {formatShortDate(weekStart)}</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/archive">Archive</Link>
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
      <JsonLd
        data={buildArticleJsonLd({
          headline: paper.title,
          description,
          path: getBriefPath(paper),
          authors: splitAuthors(paper.authorsText),
          datePublished: paper.publishedAt.toISOString(),
          dateModified: getPaperLastModified(paper).toISOString(),
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: `Week of ${formatShortDate(weekStart)}`, path: weekHref },
          { name: paper.title, path: getBriefPath(paper) },
        ])}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: `Week of ${formatShortDate(weekStart)}`, href: weekHref },
          { label: paper.title },
        ]}
      />

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
            <CardTitle>Brief context</CardTitle>
            <CardDescription>
              Publication timing, weekly edition context, and source links for this brief.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="stat-panel rounded-[22px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Week
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                <Link className="underline-offset-4 hover:underline" href={weekHref}>
                  {formatShortDate(weekStart)}
                </Link>
              </p>
            </div>
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
                Current score
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {score ? Math.round(score.totalScore) : "n/a"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Original paper</CardTitle>
            <CardDescription>
              The executive brief below is grounded in the source paper and linked back to the arXiv abstract.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-7 text-foreground/90">{paper.abstract}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="sm" variant="secondary">
                <a href={paper.abstractUrl} rel="noreferrer" target="_blank">
                  Open the original arXiv page
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6">
        <TechnicalBriefView technicalBrief={technicalBrief} score={score} />
      </section>

      {isAdmin ? (
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
                    Saving updates the live brief without changing the public URL.
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
                        placeholder={index < 3 ? "Required bullet text" : "Optional extra bullet"}
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

      <Card>
        <CardHeader>
          <CardTitle>Related briefs</CardTitle>
          <CardDescription>
            More plain-English summaries from the archive with nearby topics or operator relevance.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {related.length === 0 ? (
            <p className="text-sm text-muted-foreground">No related briefs found yet.</p>
          ) : (
            related.map((item) => (
              <div key={item.id} className="stat-panel rounded-[24px] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {item.primaryCategory ?? "Mixed"}
                </p>
                <h2 className="editorial-title mt-2 text-3xl text-foreground">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {formatDisplayAuthors(item.authorsText)}
                </p>
                <div className="mt-4 flex gap-3">
                  <Button asChild size="sm">
                    <Link href={getBriefPath(item)}>Read brief</Link>
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
        description: "A fresh generated version is now live for this paper.",
        variant: "success",
      };
    case "brief-reverted":
      return {
        title: "Reverted to generated copy",
        description: "The latest generated executive brief is live again.",
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

function splitAuthors(authorsText: string) {
  return authorsText
    .split(/\s*,\s*/)
    .map((author) => author.trim())
    .filter(Boolean);
}
