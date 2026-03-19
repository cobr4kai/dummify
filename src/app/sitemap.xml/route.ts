import { getSitemapChunks, getSitemapEntries, renderSitemapIndex, renderUrlSet } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await getSitemapEntries();
  const chunks = getSitemapChunks(entries);
  const xml = chunks.length > 1 ? renderSitemapIndex(chunks.length) : renderUrlSet(entries);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

