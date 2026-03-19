import { normalizeWhitespace } from "@/lib/utils/strings";

export function getBriefSlug(input: { title: string; arxivId: string }) {
  return `${slugify(input.title)}--${encodeBriefSuffix(input.arxivId)}`;
}

export function getBriefPath(input: { title: string; arxivId: string }) {
  return `/briefs/${getBriefSlug(input)}`;
}

export function getWeekPath(weekStart: string) {
  return `/week/${weekStart}`;
}

export function getWeekHeading(weekStart: string) {
  return `Best AI papers of the week of ${formatLongDate(weekStart)}`;
}

export function getWeekMetaDescription(weekStart: string) {
  return `Plain-English summaries of the most commercially relevant AI and arXiv papers for the week of ${formatLongDate(weekStart)}.`;
}

export function getBriefMetaDescription(title: string) {
  return `Plain-English summary of ${title}, including why it matters, what the paper claims, and where the evidence is strong or limited.`;
}

export function decodeBriefSlug(slug: string) {
  const separatorIndex = slug.lastIndexOf("--");
  if (separatorIndex === -1) {
    return null;
  }

  const encodedSuffix = slug.slice(separatorIndex + 2);
  if (!encodedSuffix) {
    return null;
  }

  try {
    return Buffer.from(encodedSuffix, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "brief";
}

function encodeBriefSuffix(arxivId: string) {
  return Buffer.from(arxivId, "utf8").toString("base64url");
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
