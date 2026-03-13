import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { loginAction } from "@/app/login/actions";
import { env } from "@/lib/env";
import { sanitizeInternalPath } from "@/lib/utils/redirect";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  error?: string;
  next?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const hasError = params.error === "invalid";
  const isConfigured = Boolean(env.ADMIN_PASSWORD);
  const nextPath = sanitizeInternalPath(params.next, "/admin");

  return (
    <PageShell
      currentPath="/login"
      className="flex min-h-[60vh] items-center justify-center"
      tone="utility"
    >
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
            Admin access
          </p>
          <CardTitle>Unlock Abstracted settings</CardTitle>
          <CardDescription>
            {isConfigured
              ? "The admin area is protected by the shared `ADMIN_PASSWORD` configured in your environment."
              : "Set `ADMIN_PASSWORD` in your environment before using the admin area."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <input name="next" type="hidden" value={nextPath} />
            <label className="space-y-2 text-sm font-medium text-foreground">
              Password
              <input
                className="field-control h-11 w-full rounded-2xl px-4 text-sm"
                disabled={!isConfigured}
                name="password"
                type="password"
              />
            </label>
            {!isConfigured ? (
              <p className="text-sm text-danger">
                `ADMIN_PASSWORD` is not configured yet, so admin login is disabled.
              </p>
            ) : hasError ? (
              <p className="text-sm text-danger">
                That password did not match the configured admin secret.
              </p>
            ) : null}
            <Button disabled={!isConfigured} type="submit">
              Continue to admin
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
