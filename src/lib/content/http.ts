import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { contentApiErrorSchema } from "@repo-types/content";

export function createContentErrorResponse(
  status: number,
  code: "invalid_request" | "not_found" | "internal_error",
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    contentApiErrorSchema.parse({
      error: {
        code,
        message,
        ...(typeof details === "undefined" ? {} : { details }),
      },
    }),
    { status },
  );
}

export function getRequestOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function toContentRouteErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return createContentErrorResponse(
      400,
      "invalid_request",
      issue?.message ?? "The request payload was invalid.",
      error.issues,
    );
  }

  return createContentErrorResponse(
    500,
    "internal_error",
    error instanceof Error ? error.message : "Unknown content API error.",
  );
}
