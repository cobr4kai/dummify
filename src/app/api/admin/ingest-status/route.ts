import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminIngestionStatus } from "@/lib/search/service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getAdminIngestionStatus();
  return NextResponse.json(status);
}
