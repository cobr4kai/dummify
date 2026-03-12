export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSearchText(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function splitKeywords(value: string) {
  return normalizeSearchText(value)
    .split(/[^a-z0-9.+-]+/)
    .filter(Boolean);
}

export function canonicalizeArxivId(rawId: string) {
  const normalized = rawId
    .replace(/^https?:\/\/arxiv\.org\/abs\//i, "")
    .replace(/^oai:arXiv\.org:/i, "")
    .trim();

  const versionMatch = normalized.match(/v(\d+)$/i);
  const version = versionMatch ? Number.parseInt(versionMatch[1], 10) : 1;
  const arxivId = normalized.replace(/v\d+$/i, "");

  return {
    arxivId,
    version,
    versionedId: `${arxivId}v${version}`,
  };
}
