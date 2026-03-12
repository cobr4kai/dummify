import type { ChunkEvidencePayload, PaperSourceRecord, PdfPageText } from "@/lib/types";

const EXECUTIVE_BRIEF_STYLE_EXAMPLE = `
## Why this is worth your attention

Multi-agent AI sounds powerful, but in practice the handoffs between agents are still messy: systems can route work to the wrong model, waste money by resending too much context, and make it hard to audit who did what when something goes wrong. This paper argues that those failures are partly a coordination and infrastructure problem, not just a model problem, and proposes a protocol meant to make multi-agent systems cheaper, faster, and easier to govern.

## Executive Brief

- The paper's core claim is that current agent-to-agent protocols are too generic for LLM systems because they hide the information that actually matters for delegation, including speed, cost, context limits, and expected quality. The practical consequence is that multi-agent systems can make clumsy routing decisions, overuse heavier models, and pay unnecessary latency or token costs.

- The proposed fix is the LLM Delegate Protocol (LDP), which gives agents a more explicit way to describe themselves and hand work off. In business terms, that means a system can more deliberately choose a cheaper or faster model when the task is simple, send more compact information between agents to reduce token spend, preserve context across longer workflows without constant retransmission, and attach audit or policy metadata to each step.

- The implementation makes the idea more credible than a purely conceptual paper. The authors built LDP as a JAMJET plugin rather than rewriting the framework, and tested it with three local Ollama models on a 36GB Apple Silicon machine, which suggests this kind of protocol upgrade could be piloted without rebuilding an entire agent stack from scratch.

- The strongest measured gains are about efficiency rather than answer quality. On easy tasks, LDP cut latency to 2.9 seconds from 34.8 seconds by routing to a lightweight model; semantic-frame payloads reduced tokens by 37% and latency by 42% with no observed quality loss; and governed sessions used 12,990 tokens versus 16,010 for stateless A2A over 10 rounds, removing 39% overhead.

- The paper is promising, but the evidence is still narrow and mixed. LDP did not beat the A2A baseline on judged routing quality in this setup, noisy provenance sometimes made results worse, and the strongest security and recovery results come from simulations rather than live adversarial testing. The fair read is that this looks like a useful protocol pattern for lowering cost, latency, and control problems in multi-agent systems, but not yet proof that it improves end-to-end outcomes.
`.trim();

export function buildChunkEvidenceSystemPrompt() {
  return [
    "You are PaperBrief's research evidence extractor for executive briefings on frontier AI papers.",
    "Use only the provided paper metadata and extracted PDF text pages.",
    "Do not invent numbers, benchmarks, tables, or citations.",
    "Every finding must cite the page where it appears.",
    "Prioritize explicit stats, capability shifts, training or inference economics, stack implications, and caveats.",
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
- Focus on capability changes, training economics, inference economics, stack impact, and strategic implications.
- Include citations for every finding and metric.
- If a page only contains setup or related work, summarize sparingly and do not force findings.

Extracted pages:
${pagePayload}
`.trim();
}

export function buildTechnicalBriefSystemPrompt() {
  return [
    "You are PaperBrief's senior research analyst writing a sharp daily brief for non-technical decision-makers.",
    "You are reading an arXiv paper and writing for an intelligent non-specialist knowledge worker such as someone in strategy, finance, operations, procurement, or product.",
    "Your job is not to restate the paper academically. Your job is to explain what it is trying to do, why the issue matters in real-world terms, what the evidence actually shows, and how seriously the reader should take the claims.",
    "Produce two sections only: a punchy hook and an executive brief.",
    "For the hook, write 1-2 vivid sentences that explain the real-world problem in plain English, why it matters operationally or economically, and whether the evidence looks strong, weak, or mixed.",
    "The hook must end on a complete sentence. If two sentences do not fit cleanly, write one sharp sentence rather than a truncated second sentence.",
    "For the executive brief, write exactly 5 bullets.",
    "Each bullet should be 2-3 sentences and written in narrative prose, not fragments.",
    "The 5 bullets should read in sequence like a short analyst note, not like disconnected takeaways.",
    "Across the 5 bullets, cover the paper's thesis, method or proposal, implementation, evidence, and bottom-line assessment.",
    "In every bullet, connect the mechanism to the consequence. Do not just say what the paper built or measured; explain why it matters in practical terms such as cost, latency, workflow reliability, auditability, governance, security, or adoption difficulty.",
    "Integrate concrete numbers, caveats, and implementation details naturally where relevant.",
    "Do not use stock phrases such as 'this paper matters because,' 'the broader takeaway is,' or 'the key stat is.'",
    "Do not invent numbers, benchmark wins, or certainty that the paper does not support.",
    "If the paper is conceptual, underpowered, weakly evidenced, or based on simulations rather than real-world tests, say so plainly.",
    "Avoid unexplained technical jargon unless it is necessary. When technical terms are needed, immediately translate them into plain-English consequences.",
    "Prefer sharp, clear, skeptical, readable, non-academic language. Do not be snarky or promotional.",
    "If the analysis fell back to abstract-only input, say so clearly and avoid fake citations.",
  ].join(" ");
}

export function buildTechnicalBriefUserPrompt(
  paper: PaperSourceRecord,
  mergedEvidence: ChunkEvidencePayload[],
  sourceBasis: "full-pdf" | "abstract-fallback",
) {
  return `
Create the final PaperBrief executive brief for this paper.

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
  - oneLineVerdict: the 1-2 sentence punchy hook
  - up to 4 keyStats using only explicit quantitative evidence
  - up to 4 focusTags chosen from models, training, inference, infra, agents, data
  - whyItMatters
  - whatToIgnore
  - exactly 5 ordered bullets in this order:
    1. Thesis
    2. Method or proposal
    3. Implementation
    4. Evidence
    5. Bottom-line assessment
- Every bullet still needs label, text, impactArea, and citations in the JSON output.
- The hook should be 1-2 sentences, vivid and sharp, and should explicitly signal whether the evidence looks strong, weak, or mixed.
- The hook must end on a complete sentence. Prefer one complete sentence over a clipped second sentence.
- Each bullet text should be 2-3 sentences in plain English prose, suitable to render as a simple bullet in a newsletter.
- Do not write mini-headings inside the bullet text.
- Integrate numbers, caveats, and implementation details naturally into the prose instead of isolating them in separate sub-bullets.
- Use this example as a model for structure, tone, and level of explanation:
${EXECUTIVE_BRIEF_STYLE_EXAMPLE}
- If sourceBasis is abstract-fallback, citations may be empty and confidence should be reduced.
- Write in plain English for smart generalists, not research specialists.
- Avoid audience-specific tabs or role callouts.
`.trim();
}
