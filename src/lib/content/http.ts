import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { contentApiErrorSchema } from "@repo-types/content";

export function createContentErrorResponse(
  status: number,
  code: "invalid_request" | "not_found" | "internal_error",
  message: string,
) {
  return NextResponse.json(
    contentApiErrorSchema.parse({
      error: {
        code,
        message,
      },
    }),
    { status },
  );
}

export function getRequestOrigin(request: Request) {
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
    );
  }

  return createContentErrorResponse(
    500,
    "internal_error",
    error instanceof Error ? error.message : "Unknown content API error.",
  );
}
