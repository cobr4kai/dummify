import { NextResponse } from "next/server";
import { articleLookupInputSchema } from "@repo-types/content";
import { createContentErrorResponse, getRequestOrigin, toContentRouteErrorResponse } from "@/lib/content/http";
import { getArticleContent, suggestArticleRefs } from "@/lib/content/service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = articleLookupInputSchema.parse({
      article_ref: searchParams.get("article_ref") ?? undefined,
      article_id: searchParams.get("article_id") ?? undefined,
      url: searchParams.get("url") ?? undefined,
      arxiv_id: searchParams.get("arxiv_id") ?? undefined,
      verbosity: searchParams.get("verbosity") ?? undefined,
    });

    const payload = await getArticleContent(input, {
      requestOrigin: getRequestOrigin(request),
    });
    if (!payload) {
      const requestedRef = input.article_ref ?? input.article_id ?? input.url ?? input.arxiv_id ?? null;
      const suggestions = requestedRef
        ? await suggestArticleRefs(requestedRef, {
            requestOrigin: getRequestOrigin(request),
          })
        : [];
      return createContentErrorResponse(404, "not_found", "Article not found.", {
        requestedRef,
        normalizedRef: requestedRef,
        suggestions,
        supportedVerbosity: ["quick", "standard", "deep"],
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return toContentRouteErrorResponse(error);
  }
}
