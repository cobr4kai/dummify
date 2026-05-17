import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { resumeIngestionRun } from "@/lib/ingestion/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    runId?: unknown;
  } | null;
  const runId = typeof body?.runId === "string" ? body.runId.trim() : "";

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const result = await resumeIngestionRun(runId);
  return NextResponse.json(result);
}
