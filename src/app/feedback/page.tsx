import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
            Tell me whether Abstracted is useful.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground/78 sm:text-base">
            This is for overall product feedback: bugs, suggestions, confusing moments, and what
            feels genuinely helpful. It is not tied to one paper page, and a short note is enough.
          </p>
        </div>
      )}
    >
      <section className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Overall product signal</CardTitle>
            <CardDescription>
              A quick yes or no is enough. Add context if you want me to understand what felt good
              or frustrating.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitFeedbackAction} className="space-y-6">
              <input name="sourcePath" type="hidden" value={sourcePath} />

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-foreground">
                  Is Abstracted useful overall?
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="cursor-pointer rounded-[24px] border border-border/80 bg-white/60 p-4 transition hover:border-foreground/20 hover:bg-white">
                    <input className="sr-only" name="sentiment" type="radio" value="USEFUL" />
                    <span className="block text-sm font-semibold text-foreground">Yes</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      It is useful overall, even if there are rough edges.
                    </span>
                  </label>
                  <label className="cursor-pointer rounded-[24px] border border-border/80 bg-white/60 p-4 transition hover:border-foreground/20 hover:bg-white">
                    <input className="sr-only" name="sentiment" type="radio" value="NOT_USEFUL" />
                    <span className="block text-sm font-semibold text-foreground">No</span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      It is not useful enough yet, or something important is getting in the way.
                    </span>
                  </label>
                </div>
              </fieldset>

              <label className="block space-y-2 text-sm font-medium text-foreground">
                What should I know?
                <Textarea
                  maxLength={2000}
                  name="message"
                  placeholder="What felt useful, confusing, broken, or missing?"
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-foreground">
                Email for follow-up
                <Input
                  autoComplete="email"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                />
              </label>

              {status === "success" ? (
                <p className="text-sm text-emerald-700">
                  Thanks. Your feedback is in the inbox now.
                </p>
              ) : status === "invalid" ? (
                <p className="text-sm text-danger">
                  Please choose Yes or No, and make sure any email address is valid.
                </p>
              ) : status === "error" ? (
                <p className="text-sm text-danger">
                  The feedback did not go through this time. Please try again.
                </p>
              ) : sourcePath ? (
                <p className="text-sm text-muted-foreground">
                  Sending this from <span className="font-medium text-foreground">{sourcePath}</span>.
                </p>
              ) : null}

              <FormSubmitButton
                idleLabel="Send feedback"
                pendingLabel="Sending..."
                type="submit"
              />
            </form>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
