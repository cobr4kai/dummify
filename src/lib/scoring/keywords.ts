import type { ExecutiveScoreComponentKey } from "@/lib/types";

type KeywordMatcher = { pattern: RegExp; score: number; reason: string };

export const EXECUTIVE_PRIORITY_FEED_CATEGORIES = [
  "cs.AI",
  "cs.LG",
  "cs.CL",
  "cs.MA",
] as const;

export const EXECUTIVE_COMPONENT_KEYWORDS: Record<
  ExecutiveScoreComponentKey,
  KeywordMatcher[]
> = {
  frontierRelevance: [
    {
      pattern:
        /\bllm\b|\blarge language model\b|\bfoundation model\b|\bgenerative ai\b|\bmultimodal\b|\bmodel serving\b|\bdeployment\b|\bserving stack\b/i,
      score: 18,
      reason:
        "Directly targets modern frontier-model, multimodal, or deployment-relevant AI systems.",
    },
    {
      pattern:
        /\bagent(?:ic)?\b|\breasoning\b|\bretrieval\b|\brag\b|\balignment\b|\bworkflow automation\b|\btool use\b|\bevaluation\b|\breliability\b/i,
      score: 14,
      reason:
        "Clearly tied to active AI system directions such as agents, evaluation, retrieval, and workflow reliability.",
    },
    {
      pattern:
        /\bdiffusion\b|\bvideo generation\b|\bimage generation\b|\btext-to-image\b|\bmultimodal workflow\b/i,
      score: 12,
      reason:
        "Connects to major current generative-model directions rather than a narrow niche.",
    },
    {
      pattern:
        /\bsurvey\b|\breview\b|\boverview\b|\btutorial\b|\bposition paper\b|\bworkshop\b|\bextended abstract\b/i,
      score: -12,
      reason:
        "Looks more like framing or commentary than a fresh result tied to major AI system trends.",
    },
  ],
  capabilityImpact: [
    {
      pattern:
        /\baccuracy\b|\bquality\b|\bperformance\b|\breasoning\b|\bbenchmark\b|\bwin rate\b|\breliability\b/i,
      score: 18,
      reason:
        "Claims a meaningful change in capability, quality, or robustness.",
    },
    {
      pattern:
        /\bstate of the art\b|\bsota\b|\boutperform(?:s|ed)?\b|\bstrong baseline\b/i,
      score: 16,
      reason:
        "Provides a direct comparative claim about better model behavior.",
    },
    {
      pattern:
        /\bplanning\b|\btool use\b|\btool-use\b|\bcontext\b|\bmemory\b|\bagent\b|\bworkflow\b|\bhallucination\b|\brobust(?:ness)?\b/i,
      score: 12,
      reason:
        "Suggests a practical improvement in how AI systems behave in real tasks.",
    },
    {
      pattern:
        /\bnarrow benchmark\b|\btoy benchmark\b|\bminor improvement\b|\bincremental\b|\bbenchmark tweak\b|\bprompting trick\b/i,
      score: -10,
      reason:
        "Reads like a narrow technical tweak with limited visible capability change.",
    },
  ],
  realWorldImpact: [
    {
      pattern:
        /\bcost\b|\bbudget\b|\befficien(?:cy|t)\b|\bmargin\b|\bcost curve\b|\bcost per query\b|\blower cost\b|\blatency\b|\bthroughput\b|\bdeployment\b|\btoken efficiency\b/i,
      score: 18,
      reason:
        "Could materially change deployment cost, operating leverage, or production efficiency.",
    },
    {
      pattern:
        /\bpre-train(?:ing)?\b|\btraining\b|\bfine[- ]tun(?:e|ing)\b|\bdistillation\b|\bdpo\b|\brlhf\b|\blora\b|\bparameter[- ]efficient\b|\bquantization\b|\bcompression\b|\bserving\b|\baccelerator\b|\bgpu\b/i,
      score: 15,
      reason:
        "Touches model-building or serving levers that can make systems cheaper or easier to ship.",
    },
    {
      pattern:
        /\bworkflow\b|\bknowledge work\b|\bdecision support\b|\bautomation\b|\boperations?\b|\boperator\b|\bprocurement\b|\bproductivit(?:y|ies)\b|\bsla\b|\bproductizable\b|\bproduction\b/i,
      score: 16,
      reason:
        "Has a visible implication for workflow automation, productization, or business decision-making.",
    },
    {
      pattern:
        /\bplatform\b|\bprotocol\b|\bruntime\b|\bkernel\b|\borchestrat(?:e|ion)\b|\bcontrol plane\b|\bgovernance\b|\bauditable\b|\bvendor\b|\binfrastructure\b|\bapi\b|\bframework\b/i,
      score: 16,
      reason:
        "Carries platform, vendor, infrastructure, or procurement implications beyond the paper itself.",
    },
    {
      pattern:
        /\bpurely theoretical\b|\bopen problem\b|\bconjecture\b|\bproof\b|\btheorem\b|\bwithout empirical validation\b/i,
      score: -12,
      reason:
        "Interesting academically, but the abstract does not show a clear cost, workflow, or deployment consequence.",
    },
  ],
  evidenceStrength: [
    {
      pattern:
        /\bbenchmark\b|\bablation\b|\berror analysis\b|\bheld-out\b|\bcomparison\b|\bevaluation\b|\breal-world\b|\bproduction trace\b/i,
      score: 18,
      reason:
        "Includes comparative structure or validation strong enough to take the claim seriously.",
    },
    {
      pattern:
        /\b\d+(?:\.\d+)?%\b|\b\d+x\b|\b\d+\.\d+\b|\btable\b|\bfigure\b|\bresults\b/i,
      score: 14,
      reason:
        "Contains explicit quantitative support rather than only narrative claims.",
    },
    {
      pattern:
        /\bstatistically significant\b|\bconfidence interval\b|\bcalibration\b/i,
      score: 12,
      reason: "Shows added rigor beyond a simple benchmark claim.",
    },
    {
      pattern:
        /\bsimulation\b|\bconceptual\b|\bposition paper\b|\bthought experiment\b|\bpreliminary\b|\bspeculative\b|\bfuture work\b/i,
      score: -12,
      reason:
        "Evidence appears thin, early, or mostly conceptual rather than strongly validated.",
    },
  ],
  audiencePull: [
    {
      pattern:
        /\bagent(?:ic)?\b|\bworkflow\b|\bautomation\b|\bknowledge work\b|\bassistant\b|\bcopilot\b|\bmultimodal\b|\bvideo generation\b|\benterprise search\b/i,
      score: 18,
      reason:
        "The topic has immediate relevance for smart non-research readers because the consequence is easy to picture.",
    },
    {
      pattern:
        /\bcost\b|\bdeployment bottleneck\b|\badoption\b|\boperator\b|\bvendor\b|\bprocurement\b|\bproduct\b|\bproduction\b|\broadmap\b/i,
      score: 15,
      reason:
        "The paper connects naturally to real operating, buying, or product decisions.",
    },
    {
      pattern:
        /\bpractical\b|\btrade[- ]off\b|\bcase study\b|\bwhy it matters\b|\bwe find\b|\bwe demonstrate\b|\btakeaway\b|\bimplication\b/i,
      score: 10,
      reason:
        "The framing is relatively legible for a business reader rather than only a specialist.",
    },
    {
      pattern:
        /\btheorem\b|\basymptotic\b|\bloss function\b|\bgradient\b|\brepresentation collapse\b|\bnarrow benchmark\b|\btoy setting\b/i,
      score: -12,
      reason:
        "Looks like a narrow technical subproblem with no obvious downstream consequence for the intended reader.",
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
  realWorldImpact: {
    "cs.AI": 7,
    "cs.LG": 6,
    "cs.MA": 7,
    "cs.CL": 4,
    "cs.IR": 4,
    "cs.CV": 3,
  },
  audiencePull: {
    "cs.AI": 7,
    "cs.MA": 6,
    "cs.CL": 5,
    "cs.CV": 5,
    "cs.IR": 4,
  },
};
