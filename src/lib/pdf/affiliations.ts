import { promises as fs } from "node:fs";
import type { PdfPageText } from "@/lib/types";
import {
  PDF_AFFILIATIONS_PROVIDER,
  pdfAffiliationEnrichmentSchema,
  type PdfAffiliationEnrichment,
} from "@/lib/metadata/schema";
import { normalizeWhitespace } from "@/lib/utils/strings";

const AFFILIATION_WINDOW_MAX_CHARS = 2200;
const AFFILIATION_STOP_PATTERNS = [
  /\babstract\b/i,
  /\bintroduction\b/i,
  /\bkeywords?\b/i,
];
const INSTITUTION_HINT_PATTERN =
  /\b(university|college|institute|school|laborator(?:y|ies)|lab\b|center|centre|hospital|research|openai|deepmind|anthropic|google|meta|microsoft|nvidia|amazon|berkeley|stanford|mit|cmu|unc|uc\s+[a-z])/i;

export async function extractPdfAffiliationPayloadFromFile(
  extractedJsonPath: string,
): Promise<PdfAffiliationEnrichment | null> {
  const raw = await fs.readFile(extractedJsonPath, "utf8");
  const pages = JSON.parse(raw) as PdfPageText[];
  return extractPdfAffiliationPayloadFromPages(pages);
}

export function extractPdfAffiliationPayloadFromPages(
  pages: PdfPageText[],
): PdfAffiliationEnrichment | null {
  const firstPage = pages[0]?.text;
  if (!firstPage) {
    return null;
  }

  const window = buildAffiliationWindow(firstPage);
  const numberedInstitutions = parseNumberedInstitutions(window);
  if (numberedInstitutions.length === 0) {
    return null;
  }

  return pdfAffiliationEnrichmentSchema.parse({
    version: PDF_AFFILIATIONS_PROVIDER,
    extractedFromPage: pages[0]?.pageNumber ?? 1,
    institutions: numberedInstitutions,
  });
}

function buildAffiliationWindow(text: string) {
  const normalized = normalizeWhitespace(
    text
      .replace(/[–—]/g, "-")
      .replace(/\u00A0/g, " ")
      .replace(/\s*\*\s*/g, " * ")
      .replace(/\s*†\s*/g, " ")
      .replace(/\s*‡\s*/g, " "),
  );

  const stopIndex = AFFILIATION_STOP_PATTERNS.reduce((current, pattern) => {
    const match = pattern.exec(normalized);
    if (!match?.index) {
      return current;
    }

    return Math.min(current, match.index);
  }, normalized.length);

  return normalized.slice(0, Math.min(stopIndex, AFFILIATION_WINDOW_MAX_CHARS));
}

function parseNumberedInstitutions(window: string) {
  const institutions = new Map<string, { displayName: string; markers: string[] }>();
  const pattern = /(?:^|[;,]\s*|\s)(\d{1,2})\s+(.+?)(?=(?:[;,]?\s+\d{1,2}\s+)|(?:\s+\*\s+)|$)/g;

  for (const match of window.matchAll(pattern)) {
    const marker = match[1]?.trim();
    const candidate = cleanInstitutionCandidate(match[2] ?? "");
    if (!marker || !candidate || !looksLikeInstitution(candidate)) {
      continue;
    }

    const key = candidate.toLowerCase();
    const current = institutions.get(key);
    institutions.set(key, {
      displayName: candidate,
      markers: current ? Array.from(new Set([...current.markers, marker])) : [marker],
    });
  }

  return Array.from(institutions.values()).slice(0, 12);
}

function cleanInstitutionCandidate(value: string) {
  return normalizeWhitespace(
    value
      .replace(/^(and|with)\s+/i, "")
      .replace(/\s+\*\s+core contributors?$/i, "")
      .replace(/[;,.]+$/g, ""),
  );
}

function looksLikeInstitution(value: string) {
  if (value.length < 4 || value.length > 140) {
    return false;
  }

  if (/\bcore contributors?\b/i.test(value)) {
    return false;
  }

  return INSTITUTION_HINT_PATTERN.test(value);
}
