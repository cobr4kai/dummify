import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";

export default function ArchiveLoading() {
  return (
    <PageShell
      currentPath="/archive"
      headerContent={(
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-8">
          <Link className="block max-w-3xl lg:pt-1" href="/">
            <h1 className="editorial-display text-3xl text-foreground sm:text-[3.45rem] lg:text-[3rem]">
              {APP_NAME}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-[1.18rem] sm:leading-8 lg:text-[1.28rem] lg:leading-[1.45]">
              {APP_TAGLINE}
            </p>
          </Link>
          <div className="mt-5 flex flex-col gap-3 lg:mt-1 lg:w-full lg:max-w-[18rem] lg:items-end">
            <div className="panel-soft w-full rounded-[28px] px-5 py-4 shadow-[var(--shadow-card)] sm:px-6">
              <p className="editorial-title text-[1.95rem] text-foreground sm:text-[2.1rem]">
                Archive
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Opening the archive and preparing the latest filters.
              </p>
            </div>
          </div>
        </div>
      )}
    >
      <section className="mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ArchiveFieldSkeleton label="Keyword" />
              <ArchiveFieldSkeleton label="Week" />
              <ArchiveFieldSkeleton label="Category" />
              <div className="sm:col-span-2 xl:col-span-1 xl:self-end">
                <div className="h-11 w-full animate-pulse rounded-2xl bg-border/60" />
              </div>
            </div>
            <p className="pt-2 text-sm text-muted-foreground">
              Refreshing archive results...
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4" aria-label="Archive results loading">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-5 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="h-6 w-24 animate-pulse rounded-full bg-border/60" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-border/50" />
              </div>

              <div className="space-y-3">
                <div className="h-8 w-4/5 animate-pulse rounded-full bg-border/55" />
                <div className="h-4 w-full animate-pulse rounded-full bg-border/45" />
                <div className="h-4 w-11/12 animate-pulse rounded-full bg-border/45" />
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-border/45" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-border/45" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-border/45" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}

function ArchiveFieldSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="h-11 w-full animate-pulse rounded-2xl bg-border/55" />
    </div>
  );
}
