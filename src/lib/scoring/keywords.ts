import type { ExecutiveScoreComponentKey } from "@/lib/types";

type KeywordMatcher = { pattern: RegExp; score: number; reason: string };

export const EXECUTIVE_PRIORITY_FEED_CATEGORIES = [
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.MA",
] as const;

export const EXECUTIVE_COMPONENT_LABELS: Record<ExecutiveScoreComponentKey, string> = {
  frontierRelevance: "Frontier relevance",
  capabilityImpact: "Capability impact",
  trainingEconomicsImpact: "Training economics",
  inferenceEconomicsImpact: "Inference economics",
  platformStackImpact: "Platform stack impact",
  strategicBusinessImpact: "Strategic business impact",
  evidenceStrength: "Evidence strength",
  claritySignal: "Clarity signal",
};

export const EXECUTIVE_COMPONENT_KEYWORDS: Record<
  ExecutiveScoreComponentKey,
  KeywordMatcher[]
> = {
  frontierRelevance: [
    {
      pattern:
        /\bllm\b|\blarge language model\b|\bfoundation model\b|\bgenerative ai\b|\bmultimodal\b|\bmodel serving\b|\bmodel efficiency\b/i,
      score: 18,
      reason: "Directly targets modern frontier-model, multimodal, or deployment-relevant AI systems.",
    },
    {
      pattern:
        /\bagent(?:ic)?\b|\breasoning\b|\bretrieval\b|\brag\b|\balignment\b|\bmodel stack\b|\bworkflow automation\b|\btool use\b|\bevaluation\b|\breliability\b/i,
      score: 14,
      reason: "Touches the active operator agenda around agents, evaluation, and workflow reliability.",
    },
    {
      pattern:
        /\bdiffusion\b|\bvideo generation\b|\bimage generation\b|\btext-to-image\b|\bmultimodal workflow\b/i,
      score: 12,
      reason: "Connects to important frontier generative model families.",
    },
    {
      pattern:
        /\bsurvey\b|\breview\b|\boverview\b|\btutorial\b|\bposition paper\b|\bworkshop\b|\bextended abstract\b/i,
      score: -12,
      reason: "Looks more like a survey or framing paper than a fresh operator-relevant result.",
    },
  ],
  capabilityImpact: [
    {
      pattern:
        /\baccuracy\b|\bquality\b|\bperformance\b|\breasoning\b|\bbenchmark\b|\bwin rate\b|\breliability\b/i,
      score: 18,
      reason: "Claims a meaningful change in capability or quality.",
    },
    {
      pattern:
        /\bstate of the art\b|\bsota\b|\boutperform(?:s|ed)?\b|\bstrong baseline\b/i,
      score: 16,
      reason: "Provides a direct competitive capability comparison.",
    },
    {
      pattern:
        /\bplanning\b|\btool use\b|\btool-use\b|\bcontext\b|\bmemory\b|\bagent\b|\bworkflow\b|\bhallucination\b|\brobust(?:ness)?\b/i,
      score: 12,
      reason: "Changes how models or agents behave in real workflows.",
    },
    {
      pattern:
        /\bnarrow benchmark\b|\btoy benchmark\b|\bminor improvement\b|\bincremental\b|\bbenchmark tweak\b|\bprompting trick\b/i,
      score: -10,
      reason: "Reads like a narrow benchmark tweak with limited operating consequence.",
    },
  ],
  trainingEconomicsImpact: [
    {
      pattern:
        /\bpre-train(?:ing)?\b|\btraining\b|\bfine[- ]tun(?:e|ing)\b|\bdistillation\b|\bdpo\b|\brlhf\b|\blora\b|\bparameter[- ]efficient\b/i,
      score: 20,
      reason: "Has direct implications for how teams train or post-train models.",
    },
    {
      pattern:
        /\bdata mixture\b|\bsynthetic data\b|\bcurriculum\b|\bscaling law\b|\boptimizer\b|\bdata efficiency\b|\bcompute[- ]optimal\b/i,
      score: 14,
      reason: "May change training data, scaling, or optimization economics.",
    },
    {
      pattern:
        /\breduce(?:d)? compute\b|\blower training cost\b|\btraining efficiency\b/i,
      score: 16,
      reason: "Explicitly addresses training efficiency or spend.",
    },
  ],
  inferenceEconomicsImpact: [
    {
      pattern:
        /\binference\b|\bserving\b|\blatency\b|\bthroughput\b|\bkv cache\b|\bmemory\b|\bquantization\b|\bmodel serving\b|\bsparsity\b|\bbatching\b/i,
      score: 20,
      reason: "Directly affects deployment-time performance and cost.",
    },
    {
      pattern:
        /\btime to first token\b|\bttft\b|\bspeculative\b|\bdecoding\b|\bcache\b|\bcompression\b/i,
      score: 16,
      reason: "Changes inference-time economics or responsiveness.",
    },
    {
      pattern:
        /\blower cost\b|\btoken efficiency\b|\bserve(?:s|d)? more\b|\baccelerator\b|\bgpu\b|\bcost per query\b/i,
      score: 14,
      reason: "Has clear unit-economics relevance for production systems.",
    },
  ],
  platformStackImpact: [
    {
      pattern:
        /\bplatform\b|\bprotocol\b|\bruntime\b|\bkernel\b|\borchestrat(?:e|ion)\b|\bcontrol plane\b|\bworkflow reliability\b|\bgovernance\b|\bauditable\b/i,
      score: 18,
      reason: "Introduces or shifts stack-level architecture decisions.",
    },
    {
      pattern:
        /\bapi\b|\bagent framework\b|\bframework\b|\btooling\b|\binfrastructure\b|\bdeployment\b|\bvendor\b|\bserving stack\b/i,
      score: 16,
      reason: "Likely to influence platform, tooling, or deployment design.",
    },
    {
      pattern:
        /\bopen[- ]source\b|\breference implementation\b|\bgithub\b|\blibrary\b/i,
      score: 12,
      reason: "Looks productizable or easy for the ecosystem to adopt.",
    },
  ],
  strategicBusinessImpact: [
    {
      pattern:
        /\bcost\b|\bbudget\b|\befficien(?:cy|t)\b|\bmargin\b|\broadmap\b|\bcompetitive\b|\bdeployment risk\b|\bcost curve\b|\bvendor leverage\b/i,
      score: 18,
      reason: "Can change cost structure, roadmap thinking, or competitive posture.",
    },
    {
      pattern:
        /\bworkflow\b|\bknowledge work\b|\bdecision support\b|\bautomation\b|\boperations?\b|\boperator\b|\bprocurement\b|\bproductivit(?:y|ies)\b|\bsla\b/i,
      score: 14,
      reason: "Has implications for how enterprises deploy AI into real work.",
    },
    {
      pattern:
        /\brisk\b|\bgovernance\b|\bsecurity\b|\baudit(?:able)?\b|\bcompliance\b/i,
      score: 12,
      reason: "Touches practical decision, governance, or risk concerns.",
    },
    {
      pattern:
        /\bpurely theoretical\b|\bopen problem\b|\bconjecture\b|\bproof\b|\btheorem\b|\bwithout empirical validation\b/i,
      score: -10,
      reason: "Looks theory-heavy relative to the product's operator-facing briefing goal.",
    },
  ],
  evidenceStrength: [
    {
      pattern:
        /\bbenchmark\b|\bablation\b|\berror analysis\b|\bheld-out\b|\bcomparison\b|\bevaluation\b|\breal-world\b|\bproduction trace\b/i,
      score: 18,
      reason: "Includes benchmark structure or comparative evidence.",
    },
    {
      pattern:
        /\b\d+(?:\.\d+)?%\b|\b\d+x\b|\b\d+\.\d+\b|\btable\b|\bfigure\b|\bresults\b/i,
      score: 14,
      reason: "Contains explicit quantitative evidence instead of only narrative claims.",
    },
    {
      pattern:
        /\bstatistically significant\b|\bconfidence interval\b|\bcalibration\b/i,
      score: 12,
      reason: "Shows extra rigor beyond headline claims.",
    },
    {
      pattern:
        /\bsimulation\b|\bconceptual\b|\bposition paper\b|\bthought experiment\b|\bpreliminary\b|\bspeculative\b|\bfuture work\b/i,
      score: -12,
      reason: "Evidence appears conceptual or simulated rather than grounded in strong empirical validation.",
    },
  ],
  claritySignal: [
    {
      pattern:
        /\btrade[- ]off\b|\bpractical\b|\bdeployment\b|\boperator\b|\bcase study\b|\bwhy it matters\b/i,
      score: 18,
      reason: "Frames the paper in practical, decision-useful language.",
    },
    {
      pattern:
        /\bwhy\b|\bimplication\b|\btakeaway\b|\bwe show\b|\bwe find\b|\bwe demonstrate\b/i,
      score: 12,
      reason: "Presents a relatively legible thesis and takeaway structure.",
    },
    {
      pattern:
        /\binterpretable\b|\bexplainable\b|\bauditable\b|\bconservative\b/i,
      score: 10,
      reason: "Improves readability and lowers hype risk for generalist readers.",
    },
  ],
};

export const EXECUTIVE_CATEGORY_BOOSTS: Partial<
  Record<ExecutiveScoreComponentKey, Record<string, number>>
> = {
  frontierRelevance: {
    "cs.AI": 8,
    "cs.LG": 8,
    "cs.CL": 7,
    "cs.MA": 8,
    "cs.IR": 4,
    "stat.ML": 4,
    "cs.CV": 3,
  },
  capabilityImpact: {
    "cs.AI": 6,
    "cs.LG": 6,
    "cs.CL": 5,
    "cs.MA": 5,
    "cs.CV": 3,
  },
  trainingEconomicsImpact: {
    "cs.LG": 8,
    "stat.ML": 6,
    "cs.AI": 4,
  },
  inferenceEconomicsImpact: {
    "cs.LG": 7,
    "cs.AI": 5,
    "cs.MA": 5,
    "cs.CV": 3,
  },
  platformStackImpact: {
    "cs.AI": 6,
    "cs.MA": 8,
    "cs.CL": 4,
    "cs.IR": 3,
  },
};
