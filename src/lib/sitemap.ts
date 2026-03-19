import { getPublicBriefSlugs, getPublicWeeks, getWeekPath } from "@/lib/briefs";
import { getSiteUrl } from "@/lib/site";

export const SITEMAP_CHUNK_SIZE = 5000;

export type SitemapEntry = {
  url: string;
  lastModified: Date;
};

export async function getSitemapEntries() {
  const [weeks, briefSlugs] = await Promise.all([getPublicWeeks(), getPublicBriefSlugs()]);

  const entries: SitemapEntry[] = [
    {
      url: getSiteUrl("/"),
      lastModified: weeks[0]?.lastModified ?? new Date(),
    },
    {
      url: getSiteUrl("/archive"),
      lastModified: weeks[0]?.lastModified ?? new Date(),
    },
    ...weeks.map((week) => ({
      url: getSiteUrl(getWeekPath(week.weekStart)),
      lastModified: week.lastModified,
    })),
    ...briefSlugs.map((brief) => ({
      url: getSiteUrl(`/briefs/${brief.slug}`),
      lastModified: brief.lastModified,
    })),
  ];

  return entries;
}

export function getSitemapChunks(entries: SitemapEntry[]) {
  const chunks: SitemapEntry[][] = [];

  for (let index = 0; index < entries.length; index += SITEMAP_CHUNK_SIZE) {
    chunks.push(entries.slice(index, index + SITEMAP_CHUNK_SIZE));
  }

  return chunks;
}

export function renderUrlSet(entries: SitemapEntry[]) {
  const body = entries
    .map(
      (entry) => `<url><loc>${escapeXml(entry.url)}</loc><lastmod>${entry.lastModified.toISOString()}</lastmod></url>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function renderSitemapIndex(pageCount: number) {
  const body = Array.from({ length: pageCount }, (_, index) => {
    const url = getSiteUrl(`/sitemaps/${index}.xml`);
    return `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
