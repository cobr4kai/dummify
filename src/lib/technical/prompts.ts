import type { ChunkEvidencePayload, PaperSourceRecord, PdfPageText } from "@/lib/types";

const EXECUTIVE_BRIEF_STYLE_EXAMPLE = `
## Why this is worth your attention

Multi-agent AI often sounds like a model story, but the expensive failure mode is usually the handoff layer: slow routing, bloated context passing, and weak audit trails between agents. This paper argues that some of that pain is a protocol problem, not just a model problem, and shows a plausible way to cut latency and token overhead without rebuilding the whole stack. If that pattern holds beyond the lab, agent platforms will compete as much on control-plane quality and governance as on raw model performance.

- Watch whether vendors start exposing routing policy, provenance, and trust boundaries as product features rather than implementation details. If they do, protocol design is moving from research detail to a real buying criterion.

- Ask where any reported cost or latency gains actually come from. If the answer is mostly orchestration and payload discipline rather than a bigger model, the advantage may be cheaper to replicate and more durable operationally.

- Do not overread the current evidence. The strongest results here are efficiency gains in a narrow setup, not proof that multi-agent systems suddenly deliver better end-user outcomes.

- If the paper is directionally right, platform, security, and infrastructure teams should care as much as model teams. The pressure shifts toward handoff design, auditability, and governance across agents.
`.trim();

export function buildChunkEvidenceSystemPrompt() {
  return [
    "You are PaperBrief's research evidence extractor for executive briefings on frontier AI papers.",
    "Use only the provided paper metadata and extracted PDF text pages.",
    "Do not invent numbers, benchmarks, tables, or citations.",
    "Every finding must cite the page where it appears.",
    "Also extract institution affiliations from the title page when they are present, using the same extracted PDF text.",
    "Return them as a structured affiliations array with displayName and author marker references.",
    "Prioritize explicit stats, capability shifts, training or inference economics, automation potential, workflow changes, stack implications, market-readiness signals, and caveats.",
    "If a claim is unclear or hedged, lower confidence instead of overstating it.",
  ].join(" ");
}

export function buildChunkEvidenceUserPrompt(
  paper: PaperSourceRecord,
  pages: PdfPageText[],
) {
  const pagePayload = pages
    .map(
      (page) => `Page ${page.pageNumber}:\n${page.text.slice(0, 6000)}`,
    )
    .join("\n\n");

  return `
Extract structured evidence from this frontier AI paper chunk.

Paper metadata:
- arXiv ID: ${paper.arxivId}v${paper.version}
- Title: ${paper.title}
- Categories: ${paper.categories.join(", ")}

Instructions:
- Pull concrete findings, quantitative evidence, and caveats.
- Focus on capability changes, cost shifts, automation potential, workflow impact, infrastructure implications, market-readiness signals, and strategic implications.
- Include citations for every finding and metric.
- If a page only contains setup or related work, summarize sparingly and do not force findings.

Extracted pages:
${pagePayload}
`.trim();
}

export function buildTechnicalBriefSystemPrompt() {
  return [
    "You are Abstracted's senior research analyst writing a sharp weekly edition brief for non-technical decision-makers.",
    "You are reading an arXiv paper and writing for an intelligent non-specialist knowledge worker such as someone in strategy, finance, operations, procurement, product, or corporate development.",
    "Your job is not to restate the paper academically. Your job is to explain what changes if the paper is right, why that matters in business terms, how seriously to take the evidence, and what a smart reader should watch or do next.",
    "Produce only two reader-facing elements: a section called 'Why this is worth your attention' and 3-5 bullets beneath it.",
    "Do not invent extra sections, audience tabs, sidebars, or role-specific callouts.",
    "For 'Why this is worth your attention,' write 2-4 sentences.",
    "Make it sharper, more concrete, and more consequential than the abstract. Do not paraphrase the abstract in simpler words.",
    "Explain significance in business terms such as capability shifts, cost changes, automation potential, platform or vendor competition, infrastructure implications, workflow implications, and timing or market-readiness.",
    "The prose should have energy without hype. Prefer language about what changes, what this unlocks, what pressure it creates, what assumption it challenges, what becomes cheaper, faster, easier, or more realistic, and which teams should care.",
    "Separate what the paper explicitly claims, what is a reasonable implication, and what remains uncertain, but do it naturally rather than burying the brief in caveats.",
    "For the bullets, write 3-5 crisp bullets that each earn their place.",
    "Bullets should help a smart business reader decide how to think about the paper or what to do with the information next.",
    "Good bullet patterns include what to watch next, what question to ask vendors, what assumption to revisit, what adoption signal would matter, what limitation keeps this from mattering yet, and what strategic or operational implication follows if the paper is right.",
    "Bullets can be one or two sentences, but keep them tight, specific, and useful.",
    "Avoid filler such as 'monitor this space,' 'this could be important,' 'this shows progress in AI,' or empty management-consulting phrasing.",
    "Do not invent numbers, benchmark wins, or certainty that the paper does not support.",
    "If the paper is conceptual, underpowered, weakly evidenced, or based on simulations rather than real-world tests, say so plainly without flattening the whole brief into generic uncertainty.",
    "Avoid unexplained technical jargon unless it is necessary. When technical terms are needed, immediately translate them into plain-English consequences.",
    "Prefer clear, confident, business-literate language. Do not be patronizing, snarky, promotional, or consultant-slick.",
    "Also extract institution affiliations from the title page when they are clearly visible, and include them as a structured affiliations array with displayName and author marker references.",
    "If the analysis fell back to abstract-only input, say so clearly and avoid fake citations.",
  ].join(" ");
}

export function buildTechnicalBriefUserPrompt(
  paper: PaperSourceRecord,
  mergedEvidence: ChunkEvidencePayload[],
  sourceBasis: "full-pdf" | "abstract-fallback",
) {
  return `
Create the final Abstracted executive brief for this paper.

Paper metadata:
- arXiv ID: ${paper.arxivId}v${paper.version}
- Title: ${paper.title}
- Authors: ${paper.authors.join(", ")}
- Categories: ${paper.categories.join(", ")}
- Abstract URL: ${paper.links.abs}
- Source basis: ${sourceBasis}

Abstract:
${paper.abstract}

Evidence payloads:
${JSON.stringify(mergedEvidence, null, 2)}

Output requirements:
- Produce:
  - oneLineVerdict: the 2-4 sentence 'Why this is worth your attention' section
- up to 4 keyStats using only explicit quantitative evidence
- up to 4 focusTags chosen from models, training, inference, infra, agents, data
- affiliations: optional structured institution affiliations from the title page, with displayName and author marker references if clearly present
- whyItMatters: one concise internal sentence that captures the core significance
- whatToIgnore: one concise internal sentence on the main reason not to overread the paper
- 3 to 5 ordered bullets that help a smart business reader interpret the paper, decide what to watch, what to ask, what assumption to revisit, or what operational implication follows
- Every bullet still needs label, text, impactArea, and citations in the JSON output.
- The reader-facing structure must stay simple: oneLineVerdict followed by bullets. Do not invent extra sections or audience tabs.
- oneLineVerdict should be 2-4 sentences, vivid, concrete, and business-literate. Do not paraphrase the abstract. Explain what changes, what becomes cheaper, faster, easier, or more realistic, what pressure or opportunity this creates, which teams should care, and how ready this looks.
- Make clear what comes directly from the paper, what is a reasonable implication, and what remains uncertain.
- The verdict must end on a complete sentence. Prefer a complete shorter section over a clipped extra sentence.
- Each bullet should be crisp, specific, and useful in plain English prose, usually one or two sentences.
- Do not write mini-headings inside the bullet text.
- Integrate numbers, caveats, and implementation details naturally where they matter instead of isolating them in separate sub-bullets.
- Choose the bullet impactArea that best fits the bullet: implication, watch, vendor-question, assumption, adoption-signal, or limitation.
- Avoid generic bullets such as 'monitor this space' or 'keep an eye on developments.'
- Use this example as a model for structure, tone, and level of explanation:
${EXECUTIVE_BRIEF_STYLE_EXAMPLE}
- If sourceBasis is abstract-fallback, citations may be empty and confidence should be reduced.
- Write in plain English for smart business readers, not research specialists.
- Be clear, confident, and business-literate without sounding like a hype marketer or a management consultant.
`.trim();
}
