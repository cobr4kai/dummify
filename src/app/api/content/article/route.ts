import { NextResponse } from "next/server";
import { articleLookupInputSchema } from "@repo-types/content";
import { createContentErrorResponse, getRequestOrigin, toContentRouteErrorResponse } from "@/lib/content/http";
import { getArticleContent } from "@/lib/content/service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = articleLookupInputSchema.parse({
      article_id: searchParams.get("article_id") ?? undefined,
      url: searchParams.get("url") ?? undefined,
      arxiv_id: searchParams.get("arxiv_id") ?? undefined,
    });

    const payload = await getArticleContent(input, {
      requestOrigin: getRequestOrigin(request),
    });
    if (!payload) {
      return createContentErrorResponse(404, "not_found", "Article not found.");
    }

    return NextResponse.json(payload);
  } catch (error) {
    return toContentRouteErrorResponse(error);
  }
}
