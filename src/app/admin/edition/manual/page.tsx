import { cookies, headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PageShell } from "@/components/page-shell";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  week?: string;
  action?: string;
  forceFetch?: string;
  maxPdfMb?: string;
}>;

type RunnerPayload = {
  weekLabel?: string;
  selectedCount?: number;
  pdfBriefsReady?: number;
  pdfBriefsMissing?: number;
  status?: string;
  processed?: {
    title: string;
    arxivId: string;
    result: string;
    pdfFetchStatus: string | null;
    message: string;
  } | null;
  items?: Array<{
    slot: number;
    title: string;
    arxivId: string;
    pdfBriefReady: boolean;
    currentBriefBasis: string;
    pdfExtractionStatus: string;
    pdfExtractionError?: string | null;
    pdfTextCached: boolean;
  }>;
};

export default async function AdminEditionManualPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin("/admin/edition/manual");
  const params = await searchParams;
  const weekStart = typeof params.week === "string" && params.week
    ? params.week
    : "2026-05-11";
  const payload = await readRunnerPayload({
    weekStart,
    action: params.action,
    forceFetch: params.forceFetch,
    maxPdfMb: params.maxPdfMb,
  });

  return (
    <PageShell
      currentPath="/admin/edition"
      tone="utility"
      headerContent={(
        <AdminPageHeader
          badges={(
            <>
              <Badge variant="muted">{payload.weekLabel ?? weekStart}</Badge>
              <Badge variant={payload.pdfBriefsMissing === 0 ? "success" : "highlight"}>
                {payload.pdfBriefsReady ?? 0}/{payload.selectedCount ?? 0} PDF briefs ready
              </Badge>
            </>
          )}
          currentPath="/admin/edition"
          description="Operator-only runner for verifying and repairing PDF-backed briefs without relying on the heavy edition table."
          title="Edition runner"
        />
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Runner status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {payload.processed ? (
            <div className="rounded-3xl border border-[rgba(215,183,82,0.2)] bg-[rgba(215,183,82,0.08)] p-4">
              <p className="text-sm uppercase tracking-[0.22em] text-[rgba(246,240,218,0.55)]">
                Last processed
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {payload.processed.title}
              </p>
              <p className="mt-1 text-sm text-[rgba(246,240,218,0.65)]">
                {payload.processed.result} · {payload.processed.pdfFetchStatus ?? "no PDF fetch"}
              </p>
              <p className="mt-2 text-sm text-[rgba(246,240,218,0.72)]">
                {payload.processed.message}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[rgba(246,240,218,0.55)]">
                <tr>
                  <th className="py-2 pr-4">Slot</th>
                  <th className="py-2 pr-4">Paper</th>
                  <th className="py-2 pr-4">Brief</th>
                  <th className="py-2 pr-4">PDF</th>
                  <th className="py-2 pr-4">Issue</th>
                </tr>
              </thead>
              <tbody>
                {(payload.items ?? []).map((item) => (
                  <tr
                    className="border-t border-[rgba(246,240,218,0.08)] align-top"
                    key={item.arxivId}
                  >
                    <td className="py-3 pr-4">{item.slot}</td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-[var(--foreground)]">{item.title}</p>
                      <p className="text-xs text-[rgba(246,240,218,0.52)]">{item.arxivId}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {item.pdfBriefReady ? "PDF ready" : item.currentBriefBasis}
                    </td>
                    <td className="py-3 pr-4">
                      {item.pdfExtractionStatus}
                      {item.pdfTextCached ? " cached" : ""}
                    </td>
                    <td className="py-3 pr-4 text-[rgba(246,240,218,0.62)]">
                      {item.pdfExtractionError ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <pre className="overflow-auto rounded-2xl bg-black/20 p-4 text-xs text-[rgba(246,240,218,0.68)]">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </PageShell>
  );
}

async function readRunnerPayload(input: {
  weekStart: string;
  action?: string;
  forceFetch?: string;
  maxPdfMb?: string;
}) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "readabstracted.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const url = new URL("/api/admin/edition-pdf-briefs", `${protocol}://${host}`);
  url.searchParams.set("week", input.weekStart);

  if (input.action) {
    url.searchParams.set("action", input.action);
  }
  if (input.forceFetch) {
    url.searchParams.set("forceFetch", input.forceFetch);
  }
  if (input.maxPdfMb) {
    url.searchParams.set("maxPdfMb", input.maxPdfMb);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      cookie: cookieStore
        .getAll()
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; "),
    },
  });

  if (!response.ok) {
    return {
      status: "failed",
      items: [],
      processed: null,
      weekLabel: input.weekStart,
      selectedCount: 0,
      pdfBriefsReady: 0,
      pdfBriefsMissing: 0,
      error: `Runner returned ${response.status}.`,
    } satisfies RunnerPayload & { error: string };
  }

  return (await response.json()) as RunnerPayload;
}
