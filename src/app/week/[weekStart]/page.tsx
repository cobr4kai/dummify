import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { JsonLd } from "@/components/json-ld";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
import {
  getPublicBriefsByWeek,
  getWeekHeading,
  getWeekMetaDescription,
  getWeekPath,
} from "@/lib/briefs";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildPageMetadata,
} from "@/lib/seo";
import { formatWeekLabel, formatWeekRange } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type Params = Promise<{ weekStart: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { weekStart } = await params;
  const week = await getPublicBriefsByWeek(weekStart);

  if (!week) {
    return buildPageMetadata({
      path: getWeekPath(weekStart),
      title: "Week not found | Abstracted",
      description: "This weekly edition is not available.",
      noIndex: true,
    });
  }

  return buildPageMetadata({
    path: getWeekPath(weekStart),
    title: `${getWeekHeading(weekStart)} | Abstracted`,
    description: getWeekMetaDescription(weekStart),
  });
}

export default async function WeekPage({ params }: { params: Params }) {
  const { weekStart } = await params;
  const week = await getPublicBriefsByWeek(weekStart);

  if (!week) {
    notFound();
  }

  const heading = getWeekHeading(week.weekStart);
  const description = getWeekMetaDescription(week.weekStart);
  const weekLabel = formatWeekLabel(week.weekStart);

  return (
    <PageShell
      currentPath={getWeekPath(week.weekStart)}
      headerContent={(
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-8">
          <div className="max-w-4xl lg:pt-1">
            <Link href="/" className="block">
              <span className="editorial-display text-3xl text-foreground sm:text-[3.1rem] lg:text-[2.8rem]">
                Abstracted
              </span>
            </Link>
            <h1 className="editorial-title mt-5 text-[2.4rem] text-foreground sm:text-[3rem] lg:text-[3.4rem]">
              {heading}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground sm:text-[1.05rem] sm:leading-8">
              {description}
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-3 lg:mt-1 lg:w-full lg:max-w-[18rem] lg:items-end">
            <div className="panel-soft w-full rounded-[28px] px-5 py-4 shadow-[var(--shadow-card)] sm:px-6">
              <p className="eyebrow text-[11px] font-medium text-muted-foreground">
                Week range
              </p>
              <p className="editorial-title mt-2 text-[1.7rem] leading-none text-foreground">
                {formatWeekRange(week.weekStart)}
              </p>
              <Link className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline" href="/archive">
                Browse all weeks
              </Link>
            </div>
          </div>
        </div>
      )}
    >
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: heading,
          description,
          path: getWeekPath(week.weekStart),
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: weekLabel, path: getWeekPath(week.weekStart) },
        ])}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: weekLabel },
        ]}
      />

      {week.papers.length === 0 ? (
        <EmptyState
          title="No briefs are available for this week."
          description="This week does not have any indexable public briefs yet."
        />
      ) : (
        <section aria-label={`Briefs for ${weekLabel}`}>
          <ul className="space-y-4">
            {week.papers.map((paper) => (
              <li key={paper.id}>
                <PaperCard paper={paper} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
