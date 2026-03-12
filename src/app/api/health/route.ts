import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");

    return NextResponse.json({
      ok: true,
      service: "paperbrief",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "paperbrief",
        error: error instanceof Error ? error.message : "Unknown health check error.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
