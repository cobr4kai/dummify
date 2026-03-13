import { NextResponse } from "next/server";
import { TriggerSource } from "@prisma/client";
import { isValidCronSecret } from "@/lib/auth";
import { runIngestionJob } from "@/lib/ingestion/service";
import { getArxivAnnouncementDateString } from "@/lib/utils/dates";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.replace("Bearer ", "")
    : null;

  if (!isValidCronSecret(bearer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobParam = searchParams.get("job");
  const dayParam = searchParams.get("day");
  const jobMode = jobParam === "reconcile" ? "RECONCILE" : "PRIMARY";
  const today = dayParam || getArxivAnnouncementDateString();
  const result = await runIngestionJob({
    mode: "DAILY",
    jobMode,
    triggerSource: TriggerSource.SCHEDULED,
    announcementDay: today,
  });

  return NextResponse.json(result);
}
