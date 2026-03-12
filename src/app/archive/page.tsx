import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { getArchiveResults } from "@/lib/search/service";
import { formatShortDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  day?: string;
  category?: string;
  sort?: string;
  highSignalOnly?: string;
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
  const sort = params.sort === "date" ? "date" : "score";
  const highSignalOnly = params.highSignalOnly === "on";

  const { papers, categories, days } = await getArchiveResults({
    search: query,
    announcementDay: day,
    category,
    sort,
    highSignalOnly,
  });

  return (
    <PageShell currentPath="/archive">
      <section className="mb-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
              Browse archive
            </p>
            <CardTitle>Search by day, topic, or keyword</CardTitle>
            <CardDescription>
              Search the real papers that were actually published to the homepage, including older days.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm font-medium">
                Keyword
                <input
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={query}
                  name="q"
                  placeholder="moe, kv cache, scaling, distillation..."
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Day
                <select
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
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
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
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
              <label className="space-y-2 text-sm font-medium">
                Sort
                <select
                  className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                  defaultValue={sort}
                  name="sort"
                >
                  <option value="score">Score</option>
                  <option value="date">Date</option>
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground sm:col-span-2 xl:col-span-3">
                <input
                  defaultChecked={highSignalOnly}
                  name="highSignalOnly"
                  type="checkbox"
                />
                Only show high-signal papers
              </label>
              <div className="sm:col-span-2 xl:col-span-1">
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
          description="Try loosening the search filters or publishing papers to the homepage first."
        />
      ) : (
        <section className="grid gap-4">
          {papers.map((paper) => (
            <Card key={paper.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="highlight">
                    Score {Math.round(paper.scores[0]?.totalScore ?? 0)}
                  </Badge>
                  <Badge variant="muted">{paper.primaryCategory ?? "Mixed"}</Badge>
                  <Badge variant="muted">{formatShortDate(paper.announcementDay)}</Badge>
                </div>
                <CardTitle>{paper.title}</CardTitle>
                <CardDescription>{paper.authorsText}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-4xl space-y-3">
                  <p className="text-sm leading-7 text-foreground/90">
                    {paper.technicalBriefs[0]?.oneLineVerdict ?? paper.abstract}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="sm">
                    <Link href={`/papers/${paper.id}`}>Open detail</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <a href={paper.abstractUrl} rel="noreferrer" target="_blank">
                      arXiv abstract
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </PageShell>
  );
}
