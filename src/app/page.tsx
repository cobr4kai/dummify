import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";
import { getDailyBrief } from "@/lib/search/service";
import { formatShortDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { papers, announcementDay } = await getDailyBrief({
    category: "all",
    sort: "score",
  });

  return (
    <PageShell
      currentPath="/"
      headerContent={(
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-8">
          <div className="max-w-3xl lg:pt-1">
            <h1 className="editorial-display text-5xl text-foreground sm:text-6xl lg:text-[4.9rem]">
              {APP_NAME}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-foreground/78 sm:text-[1.7rem] sm:leading-10 lg:text-[2rem] lg:leading-[1.5]">
              {APP_TAGLINE}
            </p>
          </div>
          <Link
            className="mt-6 block rounded-[28px] transition-transform duration-200 hover:-translate-y-0.5 lg:mt-1 lg:w-full lg:max-w-[22rem]"
            href="/archive"
          >
            <div className="panel-soft rounded-[28px] px-5 py-5 shadow-[0_16px_40px_rgba(92,73,22,0.08)] sm:px-6">
              <p className="eyebrow text-[11px] font-medium text-muted-foreground">
                Edition date
              </p>
              <p className="editorial-title mt-3 text-4xl text-foreground">
                {announcementDay ? formatShortDate(announcementDay) : "No live edition"}
              </p>
            </div>
          </Link>
        </div>
      )}
    >
      {papers.length === 0 ? (
        <EmptyState
          title="No papers match this brief."
          description="No curated papers are live for the current homepage day yet."
        />
      ) : (
        <section className="space-y-4">
          {/* TODO: Add an opening note that synthesizes the full top-10 edition into one cross-paper summary. */}
          {papers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </section>
      )}
    </PageShell>
  );
}
