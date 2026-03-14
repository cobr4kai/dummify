import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth";
import { getEmailSignupSnapshot } from "@/lib/signups/service";
import { formatLongDateTime } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function AdminSignupsPage() {
  await requireAdmin("/admin/signups");
  const snapshot = await getEmailSignupSnapshot();

  return (
    <PageShell
      currentPath="/admin/signups"
      tone="utility"
      headerContent={(
        <div className="lg:flex lg:items-end lg:justify-between lg:gap-6">
          <div className="max-w-3xl">
            <p className="eyebrow text-[11px] font-medium text-muted-foreground">
              Admin
            </p>
            <h1 className="utility-title mt-3 text-3xl text-foreground sm:text-4xl">
              Signup inbox
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/78 sm:text-base">
              Review the email list separately from article curation, with repeat submissions and
              the latest captured addresses in one place.
            </p>
            <AdminSectionNav currentPath="/admin/signups" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2 lg:mt-0">
            <Badge variant={snapshot.totalCount > 0 ? "success" : "muted"}>
              {snapshot.totalCount} total signups
            </Badge>
            <Badge variant="muted">
              {snapshot.repeatSignupCount} repeat signups
            </Badge>
          </div>
        </div>
      )}
    >
      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>List health</CardTitle>
            <CardDescription>
              A quick read on the size of the list and how often people are re-submitting.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Subscribers
              </p>
              <p className="metric-value mt-2 text-3xl text-foreground">
                {snapshot.totalCount}
              </p>
            </div>
            <div className="rounded-[24px] border border-border/80 bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Repeat submissions
              </p>
              <p className="metric-value mt-2 text-3xl text-foreground">
                {snapshot.repeatSignupCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent signups</CardTitle>
            <CardDescription>
              Newest submissions are shown first. Duplicate emails stay collapsed into one record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.signups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No signups yet. The homepage box will start populating this list once visitors opt
                in.
              </p>
            ) : (
              <div className="space-y-3">
                {snapshot.signups.map((signup) => (
                  <div
                    key={signup.id}
                    className="rounded-[24px] border border-border/80 bg-white/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{signup.email}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          Normalized as {signup.normalizedEmail}
                        </p>
                      </div>
                      <Badge variant={signup.submissionCount > 1 ? "highlight" : "muted"}>
                        {signup.submissionCount} submission{signup.submissionCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <p>First captured {formatLongDateTime(signup.createdAt)}</p>
                      <p>Last submitted {formatLongDateTime(signup.lastSubmittedAt)}</p>
                    </div>
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
