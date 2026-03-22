import { NextResponse } from "next/server";
import { openArticleInputSchema } from "@repo-types/content";
import { createContentErrorResponse, getRequestOrigin, toContentRouteErrorResponse } from "@/lib/content/http";
import { openArticleContent, suggestArticleRefs } from "@/lib/content/service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = openArticleInputSchema.parse({
      article_ref: searchParams.get("article_ref") ?? undefined,
      verbosity: searchParams.get("verbosity") ?? undefined,
    });

    const payload = await openArticleContent(input, {
      requestOrigin: getRequestOrigin(request),
    });
    if (!payload) {
      const suggestions = await suggestArticleRefs(input.article_ref, {
        requestOrigin: getRequestOrigin(request),
      });
      return createContentErrorResponse(404, "not_found", "Article not found.", {
        requestedRef: input.article_ref,
        normalizedRef: input.article_ref,
        suggestions,
        supportedVerbosity: ["quick", "standard", "deep"],
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return toContentRouteErrorResponse(error);
  }
}
