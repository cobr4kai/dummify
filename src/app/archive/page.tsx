import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { JsonLd } from "@/components/json-ld";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";
import { getPublicWeeks, getWeekPath } from "@/lib/briefs";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildPageMetadata,
} from "@/lib/seo";
import { getArchiveResults } from "@/lib/search/service";
import { formatShortDate, formatWeekLabel, getWeekStart } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  week?: string;
  day?: string;
  category?: string;
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const hasVariant =
    typeof params.q === "string" ||
    typeof params.week === "string" ||
    typeof params.day === "string" ||
    typeof params.category === "string";

  return buildPageMetadata({
    path: "/archive",
    title: "Archive | Abstracted",
    description:
      "Browse past weekly AI research briefs and plain-English summaries of commercially relevant arXiv papers.",
    noIndex: hasVariant,
  });
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const week = typeof params.week === "string"
    ? params.week
    : typeof params.day === "string"
      ? getWeekStart(params.day)
      : "all";
  const category = typeof params.category === "string" ? params.category : "all";

  const { papers, categories, weeks } = await getArchiveResults({
    search: query,
    week,
    category,
    sort: "date",
    highSignalOnly: false,
  });
  const publicWeeks = await getPublicWeeks();

  return (
    <PageShell
      currentPath="/archive"
      headerContent={(
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-8">
          <Link className="block max-w-3xl lg:pt-1" href="/">
            <span className="editorial-display text-3xl text-foreground sm:text-[3.45rem] lg:text-[3rem]">
              {APP_NAME}
            </span>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-[1.18rem] sm:leading-8 lg:text-[1.28rem] lg:leading-[1.45]">
              {APP_TAGLINE}
            </p>
          </Link>
          <div className="mt-5 flex flex-col gap-3 lg:mt-1 lg:w-full lg:max-w-[18rem] lg:items-end">
            <div className="panel-soft w-full rounded-[28px] px-5 py-4 shadow-[var(--shadow-card)] sm:px-6">
              <p className="eyebrow text-[11px] font-medium text-muted-foreground">
                Content library
              </p>
              <h1 className="editorial-title mt-2 text-[1.95rem] text-foreground sm:text-[2.1rem]">
                Archive
              </h1>
            </div>
          </div>
        </div>
      )}
    >
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: "Archive | Abstracted",
          description:
            "Browse past weekly AI research briefs and plain-English summaries of commercially relevant arXiv papers.",
          path: "/archive",
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Archive", path: "/archive" },
        ])}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Archive" },
        ]}
      />

      {weeks.length > 0 ? (
        <section className="mb-6">
          <div className="panel-soft rounded-[28px] px-5 py-5 shadow-[var(--shadow-card)] sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-[11px] font-medium text-muted-foreground">
                  Edition pages
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Jump to a specific week if you want its dedicated edition page. The full archive
                  and individual briefs stay below.
                </p>
              </div>
              <Link className="text-sm font-medium underline-offset-4 hover:underline" href="/">
                Back to homepage
              </Link>
            </div>
            <nav aria-label="Archive weeks" className="mt-4 flex flex-wrap gap-2">
              {weeks.map((option) => (
                <Link
                  key={option}
                  className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                  href={getWeekPath(option)}
                >
                  {formatWeekLabel(option)}
                </Link>
              ))}
            </nav>
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <Card>
          <CardContent className="pt-6">
            <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm font-medium">
                Keyword
                <input
                  className="field-control h-11 w-full rounded-2xl px-4 text-sm"
                  defaultValue={query}
                  name="q"
                  placeholder="moe, kv cache, scaling, distillation..."
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Week
                <select
                  className="field-control h-11 w-full rounded-2xl px-4 text-sm"
                  defaultValue={week}
                  name="week"
                >
                  <option value="all">All weeks</option>
                  {weeks.map((option) => (
                    <option key={option} value={option}>
                      {formatWeekLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Category
                <select
                  className="field-control h-11 w-full rounded-2xl px-4 text-sm"
                  defaultValue={category}
                  name="category"
                >
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.key}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2 xl:col-span-1 xl:self-end">
                <Button className="w-full" type="submit">
                  Update weekly archive
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      {publicWeeks.length > 0 ? (
        <section className="mb-6">
          <div className="panel-soft rounded-[28px] px-5 py-5 shadow-[var(--shadow-card)] sm:px-6">
            <p className="eyebrow text-[11px] font-medium text-muted-foreground">
              Library index
            </p>
            <div className="mt-4 space-y-5">
              {publicWeeks.map((publicWeek) => (
                <section key={publicWeek.weekStart}>
                  <Link
                    className="text-sm font-medium underline-offset-4 hover:underline"
                    href={getWeekPath(publicWeek.weekStart)}
                  >
                    {formatWeekLabel(publicWeek.weekStart)}
                  </Link>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {publicWeek.briefs.map((brief) => (
                      <li key={brief.id}>
                        <Link
                          className="rounded-full border px-3 py-1.5 text-sm transition hover:bg-foreground/5"
                          href={`/briefs/${brief.slug}`}
                        >
                          {brief.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {papers.length === 0 ? (
        <EmptyState
          title="No papers match this archive view."
          description="Try loosening the search filters or wait for more PDF-backed executive briefs from prior weeks to finish processing."
        />
      ) : (
        <section aria-label="Archived brief library">
          <ul className="grid gap-4">
            {papers.map((paper) => (
              <li key={paper.id}>
                <PaperCard
                  headerMeta={<Badge variant="muted">{formatShortDate(paper.announcementDay)}</Badge>}
                  paper={paper}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
