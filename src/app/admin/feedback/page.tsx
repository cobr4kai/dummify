import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth";
import { getAppFeedbackSnapshot } from "@/lib/feedback/service";
import { formatLongDateTime } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  await requireAdmin("/admin/feedback");
  const snapshot = await getAppFeedbackSnapshot();

  return (
    <PageShell
      currentPath="/admin/feedback"
      tone="utility"
      headerContent={(
        <div className="lg:flex lg:items-end lg:justify-between lg:gap-6">
          <div className="max-w-3xl">
            <p className="eyebrow text-[11px] font-medium text-muted-foreground">
              Admin
            </p>
            <h1 className="utility-title mt-3 text-3xl text-foreground sm:text-4xl">
              Feedback inbox
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/78 sm:text-base">
              Review overall product signal separately from signups and weekly curation.
            </p>
            <AdminSectionNav currentPath="/admin/feedback" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2 lg:mt-0">
            <Badge variant={snapshot.totalCount > 0 ? "success" : "muted"}>
              {snapshot.totalCount} total notes
            </Badge>
            <Badge variant="muted">
              {snapshot.withEmailCount} with email
            </Badge>
          </div>
        </div>
      )}
    >
      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inbox health</CardTitle>
            <CardDescription>
              A quick read on overall sentiment and whether people are leaving contact details.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Useful
              </p>
              <p className="metric-value mt-2 text-3xl text-foreground">
                {snapshot.usefulCount}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Not useful
              </p>
              <p className="metric-value mt-2 text-3xl text-foreground">
                {snapshot.notUsefulCount}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Total
              </p>
              <p className="metric-value mt-2 text-3xl text-foreground">
                {snapshot.totalCount}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                With email
              </p>
              <p className="metric-value mt-2 text-3xl text-foreground">
                {snapshot.withEmailCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent feedback</CardTitle>
            <CardDescription>
              Newest submissions are shown first, including quick yes or no signals with optional context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.feedback.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No feedback yet. The public feedback page will populate this inbox.
              </p>
            ) : (
              <div className="space-y-3">
                {snapshot.feedback.map((item: (typeof snapshot.feedback)[number]) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-border/80 bg-white/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.sentiment === "USEFUL" ? "success" : "highlight"}>
                          {item.sentiment === "USEFUL" ? "Useful" : "Not useful"}
                        </Badge>
                        {item.sourcePath ? (
                          <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            From {item.sourcePath}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatLongDateTime(item.createdAt)}
                      </p>
                    </div>
                    {item.message ? (
                      <p className="mt-3 text-sm leading-6 text-foreground/80">{item.message}</p>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No written note attached.
                      </p>
                    )}
                    {item.email ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Follow up at <span className="font-medium text-foreground">{item.email}</span>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
