import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
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
      headerMeta={(
        <Link
          className="block rounded-[24px] transition-transform duration-200 hover:-translate-y-0.5"
          href={announcementDay ? `/archive?day=${announcementDay}` : "/archive"}
        >
          <div className="rounded-[24px] border border-border/80 bg-white/70 px-5 py-4 shadow-sm transition-colors hover:bg-white/85">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Edition date
          </p>
          <p className="mt-2 font-serif text-3xl leading-none text-foreground">
            {announcementDay ? formatShortDate(announcementDay) : "No data"}
          </p>
          </div>
        </Link>
      )}
    >
      {papers.length === 0 ? (
        <EmptyState
          title="No papers match this brief."
          description="There is no paper data for the current daily edition yet."
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
