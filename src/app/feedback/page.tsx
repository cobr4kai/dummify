import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PageShell } from "@/components/page-shell";
import { submitFeedbackAction } from "@/app/feedback/actions";
import { sanitizeInternalPath } from "@/lib/utils/redirect";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  status?: string;
}>;

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const sourcePath = sanitizeInternalPath(params.from, "");
  const status = params.status;
  const notice = getFeedbackNotice(status, sourcePath);

  return (
    <PageShell
      currentPath="/feedback"
      tone="reader"
      headerContent={(
        <div className="max-w-3xl">
          <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
            Product feedback
          </p>
          <h1 className="mt-3 text-3xl text-foreground sm:text-4xl">
            How is ReadAbstracted feeling so far?
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground/78 sm:text-base">
            A quick signal is enough. If something felt especially useful, confusing, or frustrating,
            add a short note and I will read it in the product inbox.
          </p>
        </div>
      )}
    >
      <section className="mx-auto max-w-[42rem]">
        <Card>
          <CardHeader className="mb-3">
            <CardTitle>Quick feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submitFeedbackAction} className="space-y-5">
              <input name="sourcePath" type="hidden" value={sourcePath} />

              {sourcePath && status !== "success" && status !== "invalid" && status !== "error" ? (
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  About {sourcePath}
                </p>
              ) : null}

              <fieldset className="space-y-2.5">
                <legend className="text-sm font-medium text-foreground">
                  Has ReadAbstracted been useful so far?
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="surface-muted relative cursor-pointer rounded-[22px] border border-border/80 p-3.5 transition hover:border-foreground/20 hover:bg-[var(--panel-bg)] has-[:checked]:border-emerald-300 has-[:checked]:bg-[color-mix(in_srgb,var(--panel-bg)_78%,rgb(16,185,129)_22%)] has-[:checked]:ring-2 has-[:checked]:ring-emerald-300/55 has-[:checked]:shadow-[0_0_0_1px_rgba(52,211,153,0.32)]">
                    <input className="peer sr-only" name="sentiment" type="radio" value="USEFUL" />
                    <span className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground peer-checked:text-emerald-50">
                      <span>Yes</span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border/80 bg-transparent text-[11px] text-transparent transition peer-checked:border-emerald-200 peer-checked:bg-emerald-100 peer-checked:text-emerald-900">
                        ✓
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground peer-checked:text-emerald-100/88">
                      Useful overall, even with rough edges.
                    </span>
                  </label>
                  <label className="surface-muted relative cursor-pointer rounded-[22px] border border-border/80 p-3.5 transition hover:border-foreground/20 hover:bg-[var(--panel-bg)] has-[:checked]:border-amber-300 has-[:checked]:bg-[color-mix(in_srgb,var(--panel-bg)_80%,rgb(245,158,11)_20%)] has-[:checked]:ring-2 has-[:checked]:ring-amber-300/55 has-[:checked]:shadow-[0_0_0_1px_rgba(251,191,36,0.32)]">
                    <input className="peer sr-only" name="sentiment" type="radio" value="NOT_USEFUL" />
                    <span className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground peer-checked:text-amber-50">
                      <span>No</span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border/80 bg-transparent text-[11px] text-transparent transition peer-checked:border-amber-200 peer-checked:bg-amber-100 peer-checked:text-amber-900">
                        ✓
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground peer-checked:text-amber-100/88">
                      Not useful enough yet, or something important is missing.
                    </span>
                  </label>
                </div>
              </fieldset>

              {notice ? (
                <div className={notice.className}>
                  <p className="text-sm font-medium">{notice.title}</p>
                  {notice.body ? (
                    <p className="mt-1 text-sm leading-6 text-current/80">{notice.body}</p>
                  ) : null}
                </div>
              ) : null}

              <label className="block space-y-2 text-sm font-medium text-foreground">
                Anything you want me to know?
                <Textarea
                  maxLength={2000}
                  name="message"
                  placeholder="What felt useful, confusing, broken, or missing?"
                />
              </label>

              <div className="space-y-4 border-t border-border/70 pt-4">
                <label className="block space-y-2 text-sm font-medium text-foreground">
                  Email for follow-up (optional)
                  <Input
                    autoComplete="email"
                    name="email"
                    placeholder="you@example.com"
                    type="email"
                  />
                  <span className="block text-xs font-normal leading-5 text-muted-foreground">
                    Only include your email if you want a follow-up.
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <FormSubmitButton
                    className="w-full sm:w-auto"
                    idleLabel="Send feedback"
                    pendingLabel="Sending..."
                    size="lg"
                    type="submit"
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}

function getFeedbackNotice(status: string | undefined, sourcePath: string) {
  if (status === "success") {
    return {
      className: "rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900",
      title: "Thanks. Your note is in the inbox now.",
      body: "If you left an email, I may follow up.",
    };
  }

  if (status === "invalid") {
    return {
      className: "rounded-[24px] border border-rose-200 bg-rose-50/80 p-4 text-rose-900",
      title: "Choose Yes or No before sending.",
      body: "If you add an email, it needs to be valid.",
    };
  }

  if (status === "error") {
    return {
      className: "rounded-[24px] border border-rose-200 bg-rose-50/80 p-4 text-rose-900",
      title: "Your feedback did not go through this time.",
      body: "Please try again.",
    };
  }

  if (sourcePath) {
    return null;
  }

  return null;
}
