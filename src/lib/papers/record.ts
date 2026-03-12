import type { Paper } from "@prisma/client";
import type { PaperSourceRecord } from "@/lib/types";
import { normalizeSearchText } from "@/lib/utils/strings";

export function paperToSourceRecord(paper: Paper): PaperSourceRecord {
  return {
    arxivId: paper.arxivId,
    version: paper.version,
    versionedId: paper.versionedId,
    title: paper.title,
    abstract: paper.abstract,
    authors: Array.isArray(paper.authorsJson) ? paper.authorsJson.map(String) : [],
    categories: Array.isArray(paper.categoriesJson)
      ? paper.categoriesJson.map(String)
      : [],
    sourceFeedCategories: Array.isArray(paper.sourceFeedCategoriesJson)
      ? paper.sourceFeedCategoriesJson.map(String)
      : [],
    primaryCategory: paper.primaryCategory ?? undefined,
    publishedAt: paper.publishedAt,
    updatedAt: paper.updatedAt,
    announcementDay: paper.announcementDay,
    announceType: paper.announceType ?? undefined,
    comment: paper.comment,
    journalRef: paper.journalRef,
    doi: paper.doi,
    links: {
      abs: paper.abstractUrl,
      pdf: paper.pdfUrl ?? undefined,
    },
    sourceMetadata:
      typeof paper.sourceMetadata === "object" && paper.sourceMetadata
        ? (paper.sourceMetadata as Record<string, unknown>)
        : {},
    sourcePayload:
      typeof paper.sourcePayload === "object" && paper.sourcePayload
        ? (paper.sourcePayload as Record<string, unknown>)
        : {},
  };
}

export function buildPaperSearchText(paper: Pick<
  PaperSourceRecord,
  "title" | "abstract" | "authors" | "categories" | "comment" | "journalRef" | "doi"
>) {
  return normalizeSearchText(
    [
      paper.title,
      paper.abstract,
      paper.authors.join(" "),
      paper.categories.join(" "),
      paper.comment ?? "",
      paper.journalRef ?? "",
      paper.doi ?? "",
    ]
      .join(" ")
      .trim(),
  );
}
