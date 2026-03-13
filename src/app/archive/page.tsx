import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
import { getArchiveResults } from "@/lib/search/service";
import { formatShortDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  day?: string;
  category?: string;
}>;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const day = typeof params.day === "string" ? params.day : "all";
  const category = typeof params.category === "string" ? params.category : "all";

  const { papers, categories, days } = await getArchiveResults({
    search: query,
    announcementDay: day,
    category,
    sort: "date",
    highSignalOnly: false,
  });

  return (
    <PageShell
      currentPath="/archive"
      headerContent={(
        <div className="lg:grid lg:grid-cols-[1.3fr_0.85fr] lg:items-end lg:gap-8">
          <div className="max-w-3xl">
            <p className="eyebrow text-[11px] font-medium text-muted-foreground">
              Reader archive
            </p>
            <h1 className="editorial-display mt-4 text-4xl text-foreground sm:text-[4rem] lg:text-[3.55rem]">
              Archive
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/80 sm:text-[1.08rem] sm:leading-8">
              Search stored editions, filter by announcement day or category, and revisit the briefs that made it onto the front page.
            </p>
          </div>
          <div className="mt-6 grid gap-3 lg:mt-0">
            <div className="panel-soft rounded-[26px] px-5 py-4">
              <p className="eyebrow text-[11px] font-medium text-muted-foreground">
                Visible results
              </p>
              <p className="metric-value mt-3 text-4xl text-foreground">{papers.length}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {day === "all" ? "All stored announcement days" : `Filtered to ${formatShortDate(day)}`}.
              </p>
            </div>
          </div>
        </div>
      )}
    >
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
                Day
                <select
                  className="field-control h-11 w-full rounded-2xl px-4 text-sm"
                  defaultValue={day}
                  name="day"
                >
                  <option value="all">All days</option>
                  {days.map((option) => (
                    <option key={option} value={option}>
                      {formatShortDate(option)}
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
                  Update archive
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      {papers.length === 0 ? (
        <EmptyState
          title="No papers match this archive view."
          description="Try loosening the search filters or wait for more PDF-backed executive briefs to finish processing."
        />
      ) : (
        <section className="grid gap-4">
          {papers.map((paper) => (
            <PaperCard
              key={paper.id}
              headerMeta={<Badge variant="muted">{formatShortDate(paper.announcementDay)}</Badge>}
              paper={paper}
            />
          ))}
        </section>
      )}
    </PageShell>
  );
}
