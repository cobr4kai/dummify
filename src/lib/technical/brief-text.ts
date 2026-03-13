const LEADING_BRIEF_HEADING_PATTERN =
  /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?why this is worth your attention(?:\*\*|__)?\s*:?\s*/i;

export function stripTechnicalBriefHeading(text: string) {
  return text.replace(LEADING_BRIEF_HEADING_PATTERN, "").trim();
}

export function normalizeTechnicalBriefLead(text: string) {
  return stripTechnicalBriefHeading(text).replace(/\s+/g, " ").trim();
}
