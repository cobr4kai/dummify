import { NextResponse } from "next/server";
import { searchArticlesInputSchema } from "@repo-types/content";
import { getRequestOrigin, toContentRouteErrorResponse } from "@/lib/content/http";
import { searchArticlesContent } from "@/lib/content/service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchArticlesInputSchema.parse({
      query: searchParams.get("query") ?? "",
      topic: searchParams.get("topic") ?? undefined,
      week: searchParams.get("week") ?? undefined,
      start_date: searchParams.get("start_date") ?? undefined,
      end_date: searchParams.get("end_date") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const payload = await searchArticlesContent(input, {
      requestOrigin: getRequestOrigin(request),
    });

    return NextResponse.json(payload);
  } catch (error) {
    return toContentRouteErrorResponse(error);
  }
}
