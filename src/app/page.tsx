import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { papers, announcementDay, isCurated } = await getDailyBrief({
    category: "all",
    sort: "score",
    announcementDay: typeof params.day === "string" && params.day ? params.day : null,
  });

  return (
    <PageShell currentPath="/">
      <section className="mb-6">
        <Card>
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[220px_1fr] lg:items-start">
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Edition date
              </p>
              <p className="mt-2 font-serif text-3xl">
                {announcementDay ? formatShortDate(announcementDay) : "No data"}
              </p>
            </div>
            <div className="space-y-4">
              <CardHeader className="space-y-3 px-0 pb-0 pt-0">
                <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
                  Daily frontier brief
                </p>
                <CardTitle>
                  {isCurated
                    ? "Published frontier AI papers selected for this edition"
                    : "Top frontier AI papers worth your attention today"}
                </CardTitle>
                <CardDescription>
                  {isCurated
                    ? "This edition was manually curated from the scored paper pool in the admin editor."
                    : "A newsletter-style edition of the most important new papers shaping generative AI, model performance, and the stack around it."}
                </CardDescription>
              </CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={isCurated ? "success" : "default"}>
                  {isCurated ? `Published ${papers.length} papers` : `Top ${papers.length} papers`}
                </Badge>
                {papers.length > 0 && papers.every((paper) => paper.isDemoData) ? (
                  <Badge variant="highlight">Demo dataset</Badge>
                ) : null}
                {isCurated ? <Badge variant="muted">Admin curated edition</Badge> : null}
                <Badge variant="muted">AI-first categories only</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

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
