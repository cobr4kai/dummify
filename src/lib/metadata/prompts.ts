import type { PaperSourceRecord } from "@/lib/types";
import type { StructuredMetadataEnrichment } from "@/lib/metadata/schema";

export function buildStructuredMetadataSystemPrompt() {
  return [
    "You are Abstracted's archive metadata analyst.",
    "You are given only paper metadata, category tags, and the abstract.",
    "Produce compact, structured first-pass analysis for search and archive triage.",
    "Do not invent benchmark magnitudes, deployment proof, ablation quality, or failure modes that are not explicit in the abstract.",
    "Keep the output grounded, skeptical, and useful for archive retrieval.",
    "Use plain English.",
    "likelyAudience must only use: builders, researchers, investors, pms.",
    "caveats must stay short, concrete, and abstract-grounded.",
    "methodType should be a short label, not a paragraph.",
    "Scores are coarse first-pass judgments from 0 to 100, not precise measurements.",
  ].join(" ");
}

export function buildStructuredMetadataUserPrompt(
  paper: PaperSourceRecord,
  deterministic: StructuredMetadataEnrichment,
  input: {
    openAlexTopics: string[];
  },
) {
  return `
Create structured archive metadata for this paper from the abstract only.

Paper metadata:
- arXiv ID: ${paper.versionedId}
- Title: ${paper.title}
- Categories: ${paper.categories.join(", ")}
- Source feed categories: ${paper.sourceFeedCategories.join(", ")}
- OpenAlex topics: ${input.openAlexTopics.join(", ") || "none"}

Abstract:
${paper.abstract}

Deterministic baseline:
${JSON.stringify(
    {
      thesis: deterministic.thesis,
      whyItMatters: deterministic.whyItMatters,
      topicTags: deterministic.topicTags,
      methodType: deterministic.methodType,
      evidenceStrength: deterministic.evidenceStrength,
      likelyAudience: deterministic.likelyAudience,
      caveats: deterministic.caveats,
      noveltyScore: deterministic.noveltyScore,
      businessRelevanceScore: deterministic.businessRelevanceScore,
      sourceBasis: deterministic.sourceBasis,
    },
    null,
    2,
  )}

Output rules:
- Refine the baseline only when the abstract supports it.
- Keep thesis and whyItMatters compact and high-signal.
- topicTags and sourceBasis are already fixed elsewhere; do not try to override them.
- If the abstract is thin, keep evidenceStrength conservative and caveats explicit.
- Avoid hype, investor-pitch language, and fake certainty.
`.trim();
}
