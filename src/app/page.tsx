import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { JsonLd } from "@/components/json-ld";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
import { SignupBox } from "@/components/signup-box";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";
import { getLatestPublicWeek, getPublicBriefsByWeek, getWeekPath } from "@/lib/briefs";
import {
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildWebsiteJsonLd,
} from "@/lib/seo";
import { getDailyBrief } from "@/lib/search/service";
import { SITE_INTRO } from "@/lib/site";
import { formatWeekLabel, formatWeekRange } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  signup?: string;
}>;

export const generateMetadata = async () =>
  buildPageMetadata({
    path: "/",
    title: "Abstracted | AI research explained in plain English",
    description:
      "Read the most commercially relevant AI and arXiv papers in plain English for operators, PMs, investors, and non-research engineers.",
  });

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const initialBrief = await getDailyBrief({
    category: "all",
    sort: "score",
  });
  const fallbackWeek = initialBrief.papers.length === 0 ? await getLatestPublicWeek() : null;
  const fallbackBrief = fallbackWeek
    ? await getPublicBriefsByWeek(fallbackWeek.weekStart)
    : null;
  const papers = fallbackBrief?.papers ?? initialBrief.papers;
  const weekStart = fallbackWeek?.weekStart ?? initialBrief.weekStart;
  const weekLabel = fallbackWeek ? formatWeekLabel(fallbackWeek.weekStart) : initialBrief.weekLabel;
  const signupStatus = readSignupStatus(params.signup);
  const latestWeekHref = weekStart ? getWeekPath(weekStart) : "/archive";

  return (
    <PageShell
      currentPath="/"
      headerContent={(
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-8">
          <div className="max-w-3xl lg:pt-1">
            <h1 className="editorial-display text-3xl text-foreground sm:text-[3.45rem] lg:text-[3rem]">
              {APP_NAME}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-[1.18rem] sm:leading-8 lg:text-[1.28rem] lg:leading-[1.45]">
              {APP_TAGLINE}
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-3 lg:mt-1 lg:w-full lg:max-w-[22rem] lg:items-end">
            <Link
              className="block w-full rounded-[28px] transition-transform duration-200 hover:-translate-y-0.5"
              href={latestWeekHref}
            >
              <div className="panel-soft rounded-[28px] px-5 py-4 shadow-[var(--shadow-card)] sm:px-6">
                <p className="eyebrow text-[11px] font-medium text-muted-foreground">
                  Edition week
                </p>
                <p className="editorial-title mt-2 whitespace-nowrap text-[1.7rem] leading-none text-foreground sm:text-[1.9rem]">
                  {weekLabel ?? "No live edition"}
                </p>
                <p className="mt-2 whitespace-nowrap text-sm text-muted-foreground">
                  {weekStart ? formatWeekRange(weekStart) : "No completed week has been curated yet."}
                </p>
              </div>
            </Link>
          </div>
        </div>
      )}
      hero={<SignupBox layout="horizontal" status={signupStatus} />}
    >
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildWebsiteJsonLd()} />
      <section className="mb-6">
        <div className="panel-soft rounded-[28px] px-5 py-5 shadow-[var(--shadow-card)] sm:px-6">
          <p className="text-sm leading-7 text-muted-foreground">{SITE_INTRO}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
            <Link href={latestWeekHref} className="underline-offset-4 transition hover:underline">
              Read the latest week
            </Link>
            <Link href="/archive" className="underline-offset-4 transition hover:underline">
              Browse the archive
            </Link>
          </div>
        </div>
      </section>
      {papers.length === 0 ? (
        <EmptyState
          title="No papers match this weekly edition."
          description="No curated papers are live for the current homepage week yet."
        />
      ) : (
        <section aria-label="Latest plain-English AI research briefs">
          <ul className="space-y-4">
            {papers.map((paper) => (
              <li key={paper.id}>
                <PaperCard paper={paper} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}

function readSignupStatus(input: string | undefined) {
  if (input === "success" || input === "invalid" || input === "error") {
    return input;
  }

  return null;
}
