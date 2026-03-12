import { XMLParser } from "fast-xml-parser";
import type { PaperSourceRecord } from "@/lib/types";
import { toAnnouncementDay } from "@/lib/utils/dates";
import { canonicalizeArxivId, normalizeWhitespace } from "@/lib/utils/strings";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  textNodeName: "#text",
});

export type DailyFeedEntry = {
  arxivId: string;
  version: number;
  versionedId: string;
  announcementDay: string;
  announceType?: string;
  categories: string[];
  sourceFeedCategories: string[];
  feedCategory: string;
  raw: Record<string, unknown>;
};

export function parseDailyFeed(xml: string, feedCategory: string): DailyFeedEntry[] {
  const parsed = parser.parse(xml) as {
    rss?: {
      channel?: {
        item?: unknown;
      };
    };
  };

  const items = toArray(parsed.rss?.channel?.item);

  return items.map((item) => {
    const record = item as Record<string, unknown>;
    const description = readText(record.description);
    const idMatch = description.match(/arXiv:(\S+)/i);
    const announceMatch = description.match(/Announce Type:\s*([\w-]+)/i);
    const canonicalId = canonicalizeArxivId(idMatch?.[1] ?? readText(record.link));
    const pubDate = new Date(readText(record.pubDate));

    return {
      arxivId: canonicalId.arxivId,
      version: canonicalId.version,
      versionedId: canonicalId.versionedId,
      announcementDay: toAnnouncementDay(pubDate),
      announceType: announceMatch?.[1],
      categories: toArray(record.category).map((value) => readText(value)),
      sourceFeedCategories: [feedCategory],
      feedCategory,
      raw: record,
    };
  });
}

export function parseAtomFeed(xml: string): PaperSourceRecord[] {
  const parsed = parser.parse(xml) as {
    feed?: {
      entry?: unknown;
    };
  };

  return toArray(parsed.feed?.entry).map((entry) => {
    const record = entry as Record<string, unknown>;
    const canonicalId = canonicalizeArxivId(readText(record.id));
    const links = toArray(record.link) as Array<Record<string, unknown>>;
    const categories = toArray(record.category).map((category) =>
      readText((category as Record<string, unknown>).term ?? category),
    );
    const primaryCategoryNode =
      (record.primary_category as Record<string, unknown> | undefined) ??
      (record.primaryCategory as Record<string, unknown> | undefined);

    return {
      arxivId: canonicalId.arxivId,
      version: canonicalId.version,
      versionedId: canonicalId.versionedId,
      title: normalizeWhitespace(readText(record.title)),
      abstract: normalizeWhitespace(readText(record.summary)),
      authors: toArray(record.author).map((author) =>
        readText((author as Record<string, unknown>).name),
      ),
      categories,
      sourceFeedCategories: [],
      primaryCategory: readText(primaryCategoryNode?.term) || categories[0],
      publishedAt: new Date(readText(record.published)),
      updatedAt: new Date(readText(record.updated)),
      announcementDay: toAnnouncementDay(new Date(readText(record.published))),
      links: {
        abs:
          links.find((link) => readText(link.rel) === "alternate")?.href?.toString() ??
          `https://arxiv.org/abs/${canonicalId.arxivId}`,
        pdf: links.find((link) => readText(link.title) === "pdf")?.href?.toString(),
      },
      comment: readText(record.comment) || null,
      journalRef: readText(record.journal_ref) || null,
      doi: readText(record.doi) || null,
      sourceMetadata: {
        sourceType: "arxiv-api",
      },
      sourcePayload: record,
    };
  });
}

export function extractAbstractFromDailyDescription(description: string) {
  return normalizeWhitespace(
    description.replace(/^arXiv:\S+\s+Announce Type:\s*[\w-]+\s*Abstract:\s*/i, ""),
  );
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function readText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "#text" in value &&
    typeof (value as { "#text": unknown })["#text"] === "string"
  ) {
    return (value as { "#text": string })["#text"];
  }

  return "";
}
