import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PageShell } from "@/components/page-shell";
import { isAdminAuthenticated, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeTechnicalBriefLead } from "@/lib/technical/brief-text";
import { technicalBriefSchema } from "@/lib/technical/schema";
import { toJsonInput } from "@/lib/utils/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  week?: string;
  action?: string;
  forceFetch?: string;
  maxPdfMb?: string;
  manual?: string;
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
          {params.manual === "applied" ? (
            <div className="rounded-3xl border border-[rgba(129,184,111,0.24)] bg-[rgba(129,184,111,0.1)] p-4 text-sm text-[rgba(246,240,218,0.78)]">
              Manual PDF-backed brief saved.
            </div>
          ) : null}

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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Manual full-paper brief import</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={applyManualBriefAction} className="space-y-4">
            <input name="week" type="hidden" value={weekStart} />
            <input
              name="paperId"
              type="hidden"
              value="cmpa0ipkv011p4tlwmvn9lzt4"
            />
            <input name="model" type="hidden" value="gpt-5.5" />
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Manual brief JSON
              </span>
              <textarea
                className="min-h-56 w-full rounded-3xl border border-[rgba(246,240,218,0.14)] bg-black/20 p-4 font-mono text-xs text-[rgba(246,240,218,0.78)] outline-none focus:border-[rgba(215,183,82,0.55)]"
                name="briefJson"
                placeholder="Paste a technicalBriefSchema JSON payload generated from the full PDF."
              />
            </label>
            <button
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black"
              type="submit"
            >
              Save manual PDF-backed brief
            </button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}

async function applyManualBriefAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) {
    redirect("/login?next=/admin/edition/manual");
  }

  const week = String(formData.get("week") ?? "2026-05-11");
  const paperId = String(formData.get("paperId") ?? "");
  const model = String(formData.get("model") ?? "gpt-5.5");
  const rawPayload = String(formData.get("briefJson") ?? "");

  if (!paperId || !rawPayload.trim()) {
    redirect(`/admin/edition/manual?week=${encodeURIComponent(week)}&manual=invalid`);
  }

  let parsedPayload = null;
  try {
    parsedPayload = technicalBriefSchema.parse(JSON.parse(rawPayload));
  } catch {
    redirect(`/admin/edition/manual?week=${encodeURIComponent(week)}&manual=invalid`);
  }

  const normalizedVerdict = normalizeTechnicalBriefLead(parsedPayload.oneLineVerdict);
  await prisma.$transaction(async (tx) => {
    await tx.paperTechnicalBrief.updateMany({
      where: {
        paperId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    await tx.paperTechnicalBrief.create({
      data: {
        paperId,
        oneLineVerdict: normalizedVerdict,
        keyStatsJson: toJsonInput(parsedPayload.keyStats),
        focusTagsJson: toJsonInput(parsedPayload.focusTags),
        whyItMatters: parsedPayload.whyItMatters,
        whatToIgnore: parsedPayload.whatToIgnore,
        affiliationsJson: toJsonInput(parsedPayload.affiliations ?? []),
        executiveTakeaway: normalizedVerdict,
        bulletsJson: toJsonInput(parsedPayload.bullets),
        performanceImpact: parsedPayload.whyItMatters,
        trainingImpact: parsedPayload.whatToIgnore,
        inferenceImpact: parsedPayload.keyStats
          .map((item) => `${item.label}: ${item.value}`)
          .join(" | "),
        limitationsJson: toJsonInput([]),
        confidenceNotesJson: toJsonInput(parsedPayload.confidenceNotes),
        evidenceJson: toJsonInput(parsedPayload.evidence),
        provider: "manual:openai",
        model,
        sourceBasis: "full-pdf",
        usedFallbackAbstract: false,
      },
    });
  });

  redirect(`/admin/edition/manual?week=${encodeURIComponent(week)}&manual=applied`);
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
