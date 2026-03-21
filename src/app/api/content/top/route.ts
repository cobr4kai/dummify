import { NextResponse } from "next/server";
import { topArticlesInputSchema } from "@repo-types/content";
import { getTopArticlesContent } from "@/lib/content/service";
import { getRequestOrigin, toContentRouteErrorResponse } from "@/lib/content/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = topArticlesInputSchema.parse({
      week: searchParams.get("week") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      topic: searchParams.get("topic") ?? undefined,
    });

    const payload = await getTopArticlesContent(input, {
      requestOrigin: getRequestOrigin(request),
    });

    return NextResponse.json(payload);
  } catch (error) {
    return toContentRouteErrorResponse(error);
  }
}
