import Link from "next/link";
import { SignupBox } from "@/components/signup-box";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { PaperCard } from "@/components/paper-card";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";
import { getDailyBrief } from "@/lib/search/service";
import { formatWeekRange } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  signup?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { papers, weekLabel, weekStart } = await getDailyBrief({
    category: "all",
    sort: "score",
  });
  const signupStatus = readSignupStatus(params.signup);

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
              href="/archive"
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
      {papers.length === 0 ? (
        <EmptyState
          title="No papers match this weekly edition."
          description="No curated papers are live for the current homepage week yet."
        />
      ) : (
        <section className="space-y-4">
          {/* TODO: Add an opening note that synthesizes the full weekly edition into one cross-paper summary. */}
          {papers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
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
