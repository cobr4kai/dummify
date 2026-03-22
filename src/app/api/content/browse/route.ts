import { NextResponse } from "next/server";
import { browseArticlesInputSchema } from "@repo-types/content";
import { getRequestOrigin, toContentRouteErrorResponse } from "@/lib/content/http";
import { browseArticlesContent } from "@/lib/content/service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = browseArticlesInputSchema.parse({
      feed: searchParams.get("feed") ?? undefined,
      query: searchParams.get("query") ?? undefined,
      topic: searchParams.get("topic") ?? undefined,
      audience: searchParams.get("audience") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      week: searchParams.get("week") ?? undefined,
      start_date: searchParams.get("start_date") ?? undefined,
      end_date: searchParams.get("end_date") ?? undefined,
      has_extracted_pdf: searchParams.get("has_extracted_pdf") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const payload = await browseArticlesContent(input, {
      requestOrigin: getRequestOrigin(request),
    });

    return NextResponse.json(payload);
  } catch (error) {
    return toContentRouteErrorResponse(error);
  }
}
