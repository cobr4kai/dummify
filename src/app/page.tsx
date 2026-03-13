import Link from "next/link";
import { Button } from "@/components/ui/button";
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
      hero={(
        <section className="hero-shell rounded-[36px] px-6 py-7 sm:px-8 sm:py-8 lg:grid lg:grid-cols-[1.35fr_0.8fr] lg:items-end lg:gap-8">
          <div className="max-w-3xl">
            <p className="eyebrow text-[11px] font-medium text-muted-foreground">
              Today&apos;s editorial brief
            </p>
            <h1 className="editorial-display mt-4 text-5xl text-foreground sm:text-6xl lg:text-[5.25rem]">
              {APP_NAME}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/80 sm:text-lg sm:leading-8">
              {APP_TAGLINE} Read the latest arXiv announcements through a calmer, more curated lens.
            </p>
          </div>
          <div className="mt-6 grid gap-4 lg:mt-0">
            <div className="panel-soft rounded-[28px] px-5 py-5">
              <p className="eyebrow text-[11px] font-medium text-muted-foreground">
                Edition date
              </p>
              <p className="editorial-title mt-3 text-4xl text-foreground">
                {announcementDay ? formatShortDate(announcementDay) : "No live edition"}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {papers.length} paper{papers.length === 1 ? "" : "s"} are currently live in today&apos;s briefing.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/archive">Browse the archive</Link>
              </Button>
            </div>
          </div>
        </section>
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
