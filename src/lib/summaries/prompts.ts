import type { PaperSourceRecord } from "@/lib/types";

export function buildSummarySystemPrompt() {
  return [
    "You are PaperBrief, an analyst that translates arXiv abstracts into crisp business briefings.",
    "Use ONLY the provided title, abstract, authors, categories, dates, and links.",
    "Never claim you read the PDF or full paper.",
    "Separate fact from inference.",
    "Avoid hype, superlatives, and vague executive jargon.",
    "Do not claim benchmark superiority unless the abstract explicitly states it.",
    "Mark speculative implications as inferred rather than proven.",
    "Write for knowledgeable business readers, not academic peers.",
  ].join(" ");
}

export function buildSummaryUserPrompt(paper: PaperSourceRecord) {
  return `
Summarize this arXiv paper for business readers.

Paper metadata:
- arXiv ID: ${paper.arxivId}v${paper.version}
- Title: ${paper.title}
- Authors: ${paper.authors.join(", ")}
- Categories: ${paper.categories.join(", ")}
- Published at: ${paper.publishedAt.toISOString()}
- Updated at: ${paper.updatedAt.toISOString()}
- Abstract URL: ${paper.links.abs}

Abstract:
${paper.abstract}

Instructions:
- Produce a single clear sentence for the main summary.
- Explain why it matters in plain English.
- Give separate role-based readings for strategy, finance, and procurement.
- Include a "what this is not" clarification to reduce hype.
- Include confidence notes about uncertainty or limits.
- Define jargon simply.
- Capture key claims and implied business consequences.
- Estimate implementation maturity using only the allowed enum values.
- Optional leadership questions should be practical and specific.
- If you infer a business implication, mark it as inferred in the support/confidence fields.
`.trim();
}
