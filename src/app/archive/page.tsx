import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";
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
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-8">
          <Link className="block max-w-3xl lg:pt-1" href="/">
            <h1 className="editorial-display text-3xl text-foreground sm:text-[3.45rem] lg:text-[3rem]">
              {APP_NAME}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-foreground/78 sm:text-[1.18rem] sm:leading-8 lg:text-[1.28rem] lg:leading-[1.45]">
              {APP_TAGLINE}
            </p>
          </Link>
          <div className="mt-5 flex flex-col gap-3 lg:mt-1 lg:w-full lg:max-w-[18rem] lg:items-end">
            <div className="panel-soft w-full rounded-[28px] px-5 py-4 shadow-[var(--shadow-card)] sm:px-6">
              <p className="editorial-title text-[1.95rem] text-foreground sm:text-[2.1rem]">
                Archive
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
