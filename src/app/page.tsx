import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
import { getDailyBrief } from "@/lib/search/service";
import { formatShortDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  day?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { papers, announcementDay } = await getDailyBrief({
    category: "all",
    sort: "score",
    announcementDay: typeof params.day === "string" && params.day ? params.day : null,
  });

  return (
    <PageShell
      currentPath="/"
      headerMeta={(
        <Badge variant="muted">
          {announcementDay ? `Edition ${formatShortDate(announcementDay)}` : "Edition unavailable"}
        </Badge>
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
