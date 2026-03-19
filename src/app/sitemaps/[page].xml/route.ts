import { notFound } from "next/navigation";
import { getSitemapChunks, getSitemapEntries, renderUrlSet } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const resolvedParams = await params;
  const pageValue = resolvedParams.page;
  const page = Array.isArray(pageValue) ? pageValue[0] : pageValue;
  const pageIndex = Number.parseInt(page ?? "", 10);

  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    notFound();
  }

  const entries = await getSitemapEntries();
  const chunk = getSitemapChunks(entries)[pageIndex];

  if (!chunk) {
    notFound();
  }

  return new Response(renderUrlSet(chunk), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
