import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CANONICAL_HOST = "readabstracted.com";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  let shouldRedirect = false;

  if (host === `www.${CANONICAL_HOST}`) {
    url.host = CANONICAL_HOST;
    shouldRedirect = true;
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/") && !hasFileExtension(url.pathname)) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    shouldRedirect = true;
  }

  if (!shouldRedirect) {
    return NextResponse.next();
  }

  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

function hasFileExtension(pathname: string) {
  return /\.[a-z0-9]+$/i.test(pathname);
}
