import type { PaperSourceRecord } from "@/lib/types";
import {
  clamp,
  normalizeSearchText,
  normalizeWhitespace,
} from "@/lib/utils/strings";
import {
  openAlexEnrichmentPayloadSchema,
  structuredMetadataEnrichmentSchema,
  type StructuredMetadataEnrichment,
  type StructuredMetadataModelFields,
  type StructuredMetadataSourceBasis,
} from "@/lib/metadata/schema";

const TOPIC_TAG_LIMIT = 8;
const CAVEAT_LIMIT = 3;

const METHOD_TYPE_RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "survey or taxonomy", pattern: /\b(survey|taxonomy|review)\b/i },
  {
    label: "benchmark or evaluation",
    pattern: /\b(benchmark|evaluation|evaluate|judge|leaderboard)\b/i,
  },
  { label: "dataset or data pipeline", pattern: /\b(dataset|corpus|data pipeline)\b/i },
  {
    label: "training method",
    pattern: /\b(training|fine[- ]?tuning|distillation|alignment|pretraining|rl)\b/i,
  },
  {
    label: "inference or serving method",
    pattern: /\b(inference|serving|latency|throughput|cache|decoding|quantization)\b/i,
  },
  { label: "agent system", pattern: /\b(agent|multi-agent|tool use|workflow)\b/i },
  { label: "retrieval system", pattern: /\b(retrieval|rag|search|document collection)\b/i },
  { label: "world model or simulator", pattern: /\b(world model|simulation|simulator)\b/i },
  { label: "theoretical analysis", pattern: /\b(theory|theoretical|proof|bound|convergence)\b/i },
];

const TOPIC_RULES: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "agents", pattern: /\b(agent|agentic|multi-agent)\b/i },
  { tag: "training", pattern: /\b(training|fine[- ]?tuning|distillation|alignment|pretraining|rl)\b/i },
  { tag: "inference", pattern: /\b(inference|serving|latency|throughput|decoding|cache)\b/i },
  { tag: "infra", pattern: /\b(infra|deployment|system|orchestration|platform|governance|runtime)\b/i },
  { tag: "data", pattern: /\b(data|dataset|retrieval|rag|memory|corpus)\b/i },
  { tag: "models", pattern: /\b(model|llm|vlm|multimodal|transformer|diffusion)\b/i },
  { tag: "robotics", pattern: /\b(robot|robotics|embodied)\b/i },
  { tag: "vision", pattern: /\b(vision|image|video)\b/i },
  { tag: "reasoning", pattern: /\b(reasoning|deliberation|chain of thought)\b/i },
];

export type MetadataContext = {
  isEditorial: boolean;
  hasPdfBackedBrief: boolean;
  openAlexTopics?: string[];
};

export function getStructuredMetadataPayload(
  enrichments: Array<{ provider: string; payload: unknown }> | undefined,
) {
  const record = enrichments?.find(
    (enrichment) => enrichment.provider === "structured_metadata_v1",
  );
  const parsed = structuredMetadataEnrichmentSchema.safeParse(record?.payload);
  return parsed.success ? parsed.data : null;
}

export function getOpenAlexTopics(
  enrichments: Array<{ provider: string; payload: unknown }> | undefined,
) {
  const payload = getOpenAlexPayload(enrichments);
  return payload?.topics ?? [];
}

export function getOpenAlexInstitutions(
  enrichments: Array<{ provider: string; payload: unknown }> | undefined,
) {
  const payload = getOpenAlexPayload(enrichments);
  return payload?.institutions?.map((institution) => institution.displayName) ?? [];
}

export function getOpenAlexPayload(
  enrichments: Array<{ provider: string; payload: unknown }> | undefined,
) {
  const record = enrichments?.find((enrichment) => enrichment.provider === "openalex");
  const parsed = openAlexEnrichmentPayloadSchema.safeParse(record?.payload);
  return parsed.success ? parsed.data : null;
}

export function buildOpenAlexSearchText(
  enrichments: Array<{ provider: string; payload: unknown }> | undefined,
) {
  const payload = getOpenAlexPayload(enrichments);
  if (!payload) {
    return "";
  }

  return normalizeWhitespace(
    [
      payload.displayName ?? "",
      ...(payload.topics ?? []),
      ...(payload.institutions?.map((institution) => institution.displayName) ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function resolveStructuredMetadataSourceBasis(
  context: MetadataContext,
): StructuredMetadataSourceBasis {
  if (context.isEditorial && context.hasPdfBackedBrief) {
    return "editorial";
  }

  if (context.hasPdfBackedBrief) {
    return "pdf_backed";
  }

  return "abstract_only";
}

export function buildDeterministicStructuredMetadata(
  paper: PaperSourceRecord,
  context: MetadataContext,
): StructuredMetadataEnrichment {
  const normalizedText = normalizeSearchText(`${paper.title} ${paper.abstract}`);
  const topicTags = buildTopicTags(paper, context);
  const methodType = inferMethodType(normalizedText);
  const likelyAudience = inferLikelyAudience(normalizedText, methodType);
  const evidenceStrength = inferEvidenceStrength(normalizedText, paper.abstract);
  const noveltyScore = inferNoveltyScore(normalizedText);
  const businessRelevanceScore = inferBusinessRelevanceScore(normalizedText, topicTags);
  const thesis = buildDeterministicThesis(paper.abstract, paper.title);
  const whyItMatters = buildDeterministicWhyItMatters(
    likelyAudience,
    methodType,
    context,
    topicTags,
  );
  const caveats = buildDeterministicCaveats(
    normalizedText,
    evidenceStrength,
    methodType,
  );

  return structuredMetadataEnrichmentSchema.parse({
    version: "structured_metadata_v1",
    sourceBasis: resolveStructuredMetadataSourceBasis(context),
    thesis,
    whyItMatters,
    topicTags,
    methodType,
    evidenceStrength,
    likelyAudience,
    caveats,
    noveltyScore,
    businessRelevanceScore,
    searchText: buildStructuredMetadataSearchText({
      thesis,
      whyItMatters,
      topicTags,
      methodType,
      likelyAudience,
      caveats,
      sourceBasis: resolveStructuredMetadataSourceBasis(context),
    }),
    generationMode: "deterministic_only",
  });
}

export function mergeStructuredMetadataModelFields(
  deterministic: StructuredMetadataEnrichment,
  modelFields: StructuredMetadataModelFields,
) {
  const nextPayload = {
    ...deterministic,
    ...modelFields,
    likelyAudience: uniqueStrings(modelFields.likelyAudience),
    caveats: modelFields.caveats.slice(0, CAVEAT_LIMIT),
    noveltyScore: clamp(Math.round(modelFields.noveltyScore)),
    businessRelevanceScore: clamp(Math.round(modelFields.businessRelevanceScore)),
    searchText: buildStructuredMetadataSearchText({
      thesis: modelFields.thesis,
      whyItMatters: modelFields.whyItMatters,
      topicTags: deterministic.topicTags,
      methodType: modelFields.methodType,
      likelyAudience: uniqueStrings(modelFields.likelyAudience),
      caveats: modelFields.caveats.slice(0, CAVEAT_LIMIT),
      sourceBasis: deterministic.sourceBasis,
    }),
    generationMode: "hybrid" as const,
  };

  return structuredMetadataEnrichmentSchema.parse(nextPayload);
}

export function buildStructuredMetadataSearchText(input: {
  thesis: string;
  whyItMatters: string;
  topicTags: string[];
  methodType: string;
  likelyAudience: string[];
  caveats: string[];
  sourceBasis: StructuredMetadataSourceBasis;
}) {
  return normalizeWhitespace(
    [
      input.thesis,
      input.whyItMatters,
      input.topicTags.join(" "),
      input.methodType,
      input.likelyAudience.join(" "),
      input.caveats.join(" "),
      input.sourceBasis.replace(/_/g, " "),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function buildTopicTags(paper: PaperSourceRecord, context: MetadataContext) {
  const text = normalizeSearchText(`${paper.title} ${paper.abstract}`);
  const derived = TOPIC_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.tag);

  return uniqueStrings([
    ...(context.openAlexTopics ?? []),
    ...paper.categories,
    ...paper.sourceFeedCategories,
    ...derived,
  ]).slice(0, TOPIC_TAG_LIMIT);
}

function inferMethodType(normalizedText: string) {
  return (
    METHOD_TYPE_RULES.find((rule) => rule.pattern.test(normalizedText))?.label ??
    "research system"
  );
}

function inferLikelyAudience(normalizedText: string, methodType: string) {
  const audiences = new Set<"builders" | "researchers" | "investors" | "pms">();

  if (
    /\b(agent|deployment|platform|workflow|orchestration|infra|serving|latency|retrieval|rag|runtime)\b/i.test(
      normalizedText,
    )
  ) {
    audiences.add("builders");
  }

  if (
    /\b(cost|efficiency|enterprise|vendor|market|economics|pricing|roi|adoption)\b/i.test(
      normalizedText,
    )
  ) {
    audiences.add("investors");
  }

  if (
    /\b(product|workflow|assistant|user|customer|knowledge work|reliability)\b/i.test(
      normalizedText,
    )
  ) {
    audiences.add("pms");
  }

  if (
    /\b(theory|theoretical|benchmark|evaluation|dataset|proof|analysis|survey|taxonomy)\b/i.test(
      normalizedText,
    )
  ) {
    audiences.add("researchers");
  }

  if (methodType === "theoretical analysis") {
    audiences.add("researchers");
  }

  if (audiences.size === 0) {
    audiences.add("researchers");
  }

  return Array.from(audiences);
}

function inferEvidenceStrength(normalizedText: string, abstract: string) {
  let score = 18;

  if (/\b\d+(\.\d+)?(%|x|ms|s|m|b)\b/i.test(abstract)) {
    score += 24;
  }
  if (/\b(benchmark|benchmarks|ablation|experiment|experiments|evaluation|results)\b/i.test(normalizedText)) {
    score += 18;
  }
  if (/\b(real-world|production|deployed|field study)\b/i.test(normalizedText)) {
    score += 14;
  }
  if (/\b(simulation|simulated|synthetic)\b/i.test(normalizedText)) {
    score -= 8;
  }
  if (/\b(theory|theoretical|survey|taxonomy|review)\b/i.test(normalizedText)) {
    score -= 12;
  }

  if (score >= 48) {
    return "high";
  }
  if (score >= 28) {
    return "medium";
  }
  return "low";
}

function inferNoveltyScore(normalizedText: string) {
  let score = 42;

  if (/\b(novel|new|first|unified|generalizable|continual|automatic|scalable)\b/i.test(normalizedText)) {
    score += 16;
  }
  if (/\b(benchmark|taxonomy|survey|review)\b/i.test(normalizedText)) {
    score -= 8;
  }
  if (/\b(theory|theoretical)\b/i.test(normalizedText)) {
    score -= 4;
  }

  return clamp(score);
}

function inferBusinessRelevanceScore(normalizedText: string, topicTags: string[]) {
  let score = 34;

  if (
    /\b(agent|workflow|enterprise|deployment|platform|latency|throughput|cost|automation|governance|reliability|serving)\b/i.test(
      normalizedText,
    )
  ) {
    score += 26;
  }
  if (topicTags.some((tag) => ["agents", "infra", "inference", "data"].includes(tag))) {
    score += 12;
  }
  if (/\b(theory|taxonomy|survey|review|asymptotic|proof)\b/i.test(normalizedText)) {
    score -= 10;
  }

  return clamp(score);
}

function buildDeterministicThesis(abstract: string, title: string) {
  const normalizedAbstract = normalizeWhitespace(abstract);
  const match = normalizedAbstract.match(/.+?[.!?](?:\s|$)/);
  const lead = normalizeWhitespace(match?.[0] ?? normalizedAbstract);

  if (lead.length >= 20) {
    return truncate(lead, 280);
  }

  return truncate(`${title}: ${normalizedAbstract}`, 280);
}

function buildDeterministicWhyItMatters(
  likelyAudience: string[],
  methodType: string,
  context: MetadataContext,
  topicTags: string[],
) {
  if (context.isEditorial && context.hasPdfBackedBrief) {
    return "This paper was strong enough to earn a curated premium brief, so it likely has clearer near-term decision value than the average archive entry.";
  }

  if (likelyAudience.includes("builders")) {
    return `This looks most relevant for teams building or operating AI systems, especially where ${topicTags.slice(0, 2).join(" and ") || "deployment"} decisions affect product or infrastructure choices.`;
  }

  if (likelyAudience.includes("investors")) {
    return "This looks relevant for people tracking where capability, cost, or workflow shifts could change market timing and competitive pressure.";
  }

  if (likelyAudience.includes("pms")) {
    return "This looks useful for people deciding which AI product bets or workflow changes deserve attention before a deeper read.";
  }

  return `This looks most useful as a first-pass read on a ${methodType} paper before investing in deeper evidence review.`;
}

function buildDeterministicCaveats(
  normalizedText: string,
  evidenceStrength: "low" | "medium" | "high",
  methodType: string,
) {
  const caveats: string[] = [];

  if (/\b(simulation|simulated|synthetic|benchmark)\b/i.test(normalizedText)) {
    caveats.push(
      "The abstract leans on benchmark or simulated evidence, so real-world performance may still be uncertain.",
    );
  }

  if (/\b(theory|theoretical|proof|analysis)\b/i.test(normalizedText)) {
    caveats.push(
      "This looks more analytical than deployment-ready, so practical impact may depend on follow-on systems work.",
    );
  }

  if (/\b(survey|taxonomy|review)\b/i.test(normalizedText)) {
    caveats.push(
      "This appears to organize or evaluate the field rather than introduce a directly deployable product capability.",
    );
  }

  if (evidenceStrength === "low") {
    caveats.push(
      "The abstract gives limited quantitative detail, so evidence strength is hard to judge without reading further.",
    );
  }

  if (caveats.length === 0) {
    caveats.push(
      `This is an abstract-only read on a ${methodType} paper, so the deeper trade-offs and implementation limits may be missing here.`,
    );
  }

  return caveats.slice(0, CAVEAT_LIMIT);
}

function truncate(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean),
    ),
  );
}
