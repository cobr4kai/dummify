import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { PageShell } from "@/components/page-shell";
import { buildBreadcrumbJsonLd, buildCollectionPageJsonLd, buildPageMetadata } from "@/lib/seo";
import { getPublicWeeks, getWeekPath } from "@/lib/briefs";
import { formatWeekLabel } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export const generateMetadata = async () =>
  buildPageMetadata({
    path: "/sitemap",
    title: "Sitemap | Abstracted",
    description: "Browse every weekly edition page and individual brief page published on Abstracted.",
  });

export default async function HtmlSitemapPage() {
  const weeks = await getPublicWeeks();

  return (
    <PageShell currentPath="/sitemap">
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: "Sitemap | Abstracted",
          description: "Browse every weekly edition page and individual brief page published on Abstracted.",
          path: "/sitemap",
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Sitemap", path: "/sitemap" },
        ])}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Sitemap" },
        ]}
      />

      <section className="mb-6 max-w-3xl">
        <p className="eyebrow text-[11px] font-medium text-muted-foreground">
          Library sitemap
        </p>
        <h1 className="editorial-title mt-3 text-[2.2rem] text-foreground sm:text-[2.6rem]">
          All weeks and briefs
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Crawlable links to every public weekly edition page and every individual brief page.
        </p>
      </section>

      {weeks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No public weekly editions are available yet.
        </p>
      ) : (
        <nav aria-label="HTML sitemap" className="space-y-8">
          {weeks.map((week) => (
            <section key={week.weekStart}>
              <h2 className="text-lg font-semibold text-foreground">
                <Link className="underline-offset-4 hover:underline" href={getWeekPath(week.weekStart)}>
                  {formatWeekLabel(week.weekStart)}
                </Link>
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {week.briefs.map((brief) => (
                  <li key={brief.id}>
                    <Link
                      className="text-sm leading-6 text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
                      href={`/briefs/${brief.slug}`}
                    >
                      {brief.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      )}
    </PageShell>
  );
}
