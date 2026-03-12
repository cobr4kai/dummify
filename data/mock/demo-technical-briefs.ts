import type { StructuredTechnicalBrief } from "@/lib/types";

type TechnicalBriefFixture = {
  arxivId: string;
  brief: StructuredTechnicalBrief;
};

const cite = (page: number, section?: string) => ({
  page,
  section: section ?? null,
  quote: null,
});

export const demoTechnicalBriefFixtures: TechnicalBriefFixture[] = [
  {
    arxivId: "2603.08877",
    brief: {
      oneLineVerdict:
        "This is a highly usable operator paper: it suggests better GenAI search quality can come from smarter orchestration before teams spend more on larger models.",
      keyStats: [
        {
          label: "Search depth",
          value: "Small increase",
          context: "The strongest quality gains come from a modest increase in search depth rather than an open-ended expansion.",
          citations: [cite(6, "Main results")],
        },
        {
          label: "Retrieval mix",
          value: "Hybrid wins",
          context: "Hybrid retrieval plus light re-ranking captures most of the reported improvement in the paper's setup.",
          citations: [cite(7, "Ablation grid")],
        },
      ],
      focusTags: ["agents", "inference", "infra"],
      whyItMatters:
        "For executives, the message is simple: some of the next quality gains in GenAI search may come from better retrieval orchestration and tighter cost controls, not just bigger model spend.",
      whatToIgnore:
        "Do not read this as proof that every RAG stack improves the same way or that orchestration fully replaces model upgrades; the evidence is still task- and dataset-specific.",
      bullets: [
        {
          label: "Core thesis",
          text: "This paper matters because it argues that better search orchestration can improve answer quality in agentic search without immediately paying up for a larger base model, which is exactly the kind of operating leverage decision-makers should care about.",
          impactArea: "thesis",
          citations: [cite(1, "Abstract"), cite(6, "Main results")],
        },
        {
          label: "Core mechanism",
          text: "What is novel is not a new model family but a disciplined orchestration design that combines modestly deeper search, hybrid retrieval, light re-ranking, and explicit budget controls under deployment-like constraints.",
          impactArea: "method-or-proposal",
          citations: [cite(3, "Method"), cite(5, "System design")],
        },
        {
          label: "Practical credibility",
          text: "The proposal is believable in practice because the paper evaluates the orchestration choices under explicit cost and quality tradeoffs rather than treating retrieval design as a purely conceptual layer above the model.",
          impactArea: "implementation",
          citations: [cite(5, "System design"), cite(6, "Cost-quality tradeoff")],
        },
        {
          label: "Results",
          text: "The key result is that most of the quality gain appears to come from a relatively small increase in search depth plus hybrid retrieval and re-ranking, which is useful, but it is not evidence of a universal leap and should be read as a cost-quality optimization rather than a breakthrough benchmark jump.",
          impactArea: "evidence",
          citations: [cite(6, "Main results"), cite(7, "Ablation grid"), cite(9, "Limitations")],
        },
        {
          label: "Broader takeaway",
          text: "The broader takeaway is that a meaningful share of GenAI performance and margin improvement may come from the system wrapped around the model rather than the model weights themselves, so teams should benchmark orchestration levers before defaulting to bigger-model spend.",
          impactArea: "assessment",
          citations: [cite(7, "Datasets"), cite(8, "Operational guidance"), cite(9, "Limitations")],
        },
      ],
      confidenceNotes: [
        "Confidence is relatively high because the paper includes controlled comparisons rather than only conceptual claims.",
        "The operational read is still partly inferred from the research setup rather than a large-scale production deployment.",
      ],
      evidence: [
        {
          claim: "A limited number of extra searches improves answer quality before gains flatten.",
          impactArea: "capability",
          confidence: "high",
          citations: [cite(6, "Main results")],
        },
        {
          claim: "Hybrid retrieval with lightweight re-ranking is the strongest tradeoff in the reported ablation grid.",
          impactArea: "inference",
          confidence: "high",
          citations: [cite(7, "Ablation grid")],
        },
        {
          claim: "Cost controls and search-step instrumentation are central for production deployments.",
          impactArea: "stack",
          confidence: "medium",
          citations: [cite(8, "Operational discussion")],
        },
      ],
      sourceBasis: "full-pdf",
      usedFallbackAbstract: false,
    },
  },
  {
    arxivId: "2603.08852",
    brief: {
      oneLineVerdict:
        "This is a stack paper, not a model-breakthrough paper, but it matters because protocol design may become a real lever for agent latency, control, and auditability.",
      keyStats: [
        {
          label: "Latency",
          value: "Lower with routing",
          context: "The paper reports lower latency when tasks are routed through identity-aware delegate selection.",
          citations: [cite(6, "Latency results")],
        },
        {
          label: "Token overhead",
          value: "Reduced",
          context: "Governed sessions cut token overhead in the authors' evaluation setup.",
          citations: [cite(7, "Token overhead")],
        },
      ],
      focusTags: ["agents", "infra", "inference"],
      whyItMatters:
        "If multi-agent systems become more common, the control plane around routing, trust, provenance, and session design may become as important as model choice itself.",
      whatToIgnore:
        "Do not read this as proof that multi-agent systems are the default future of enterprise AI; the upside here depends heavily on adoption and architecture assumptions.",
      bullets: [
        {
          label: "Core thesis",
          text: "The bottom-line message is that protocol design can materially change how well multi-agent GenAI systems perform in practice, which means the control layer around agents may become almost as important as the models themselves.",
          impactArea: "thesis",
          citations: [cite(1, "Abstract"), cite(2, "Protocol overview")],
        },
        {
          label: "Core mechanism",
          text: "The protocol is built around explicit model identity, trust domains, provenance, governed sessions, and payload negotiation, with the central claim that these traits should be first-class protocol elements rather than hidden metadata or bolt-on extensions.",
          impactArea: "method-or-proposal",
          citations: [cite(3, "Identity cards"), cite(4, "Trust domains")],
        },
        {
          label: "Practical credibility",
          text: "The proposal is more credible than a pure thought experiment because the paper includes a working implementation added as a plugin to a live agent runtime, showing the protocol can function as a practical reference design rather than only an architectural sketch.",
          impactArea: "implementation",
          citations: [cite(5, "Reference implementation"), cite(8, "Platform implications")],
        },
        {
          label: "Results",
          text: "In the experiments, the strongest result is not a dramatic answer-quality jump but a meaningful efficiency story: identity-aware routing reduces latency on easier tasks and governed sessions lower token overhead, while the quality gains remain more modest and sensitive to the evaluation setup.",
          impactArea: "evidence",
          citations: [cite(6, "Latency results"), cite(7, "Session efficiency"), cite(9, "Limitations")],
        },
        {
          label: "Broader takeaway",
          text: "The broader takeaway is that even if AI-native protocols do not automatically improve answer quality, they can still materially improve latency, token efficiency, governance, and security, which makes protocol design a real part of the GenAI stack conversation rather than a side issue.",
          impactArea: "assessment",
          citations: [cite(7, "Evaluation setup"), cite(9, "Limitations")],
        },
      ],
      confidenceNotes: [
        "Confidence is medium because the efficiency claims are concrete but the broader strategic importance depends on agent adoption.",
        "This is more useful for stack thinkers than for people looking for a direct model benchmark leap.",
      ],
      evidence: [
        {
          claim: "Identity-aware routing can lower latency on easier tasks.",
          impactArea: "inference",
          confidence: "high",
          citations: [cite(6, "Latency results")],
        },
        {
          claim: "Governed sessions reduce token overhead.",
          impactArea: "stack",
          confidence: "high",
          citations: [cite(7, "Session efficiency")],
        },
        {
          claim: "Protocol primitives may become a meaningful GenAI platform differentiator.",
          impactArea: "strategic",
          confidence: "medium",
          citations: [cite(8, "Discussion")],
        },
      ],
      sourceBasis: "full-pdf",
      usedFallbackAbstract: false,
    },
  },
  {
    arxivId: "2603.08938",
    brief: {
      oneLineVerdict:
        "This is a strategic signal more than an operational playbook: it sketches where AI-native software stacks could go if agent platforms mature.",
      keyStats: [],
      focusTags: ["agents", "infra", "data"],
      whyItMatters:
        "Even without a blockbuster benchmark result, the paper is useful because it frames a possible future stack where orchestration, context, and persistent knowledge become the real product surface.",
      whatToIgnore:
        "Do not mistake this for proof that agent operating systems are ready for enterprise deployment now; it is primarily a research agenda and architectural thesis.",
      bullets: [
        {
          label: "Core thesis",
          text: "This is a strategic signal more than an operator playbook: the paper argues for an AI-native software layer where agents and natural language coordination sit above traditional app-centric interfaces.",
          impactArea: "thesis",
          citations: [cite(1, "Abstract"), cite(2, "System vision")],
        },
        {
          label: "Core mechanism",
          text: "The core idea is an operating-system-like layer in which an agent kernel coordinates tools, workflows, context, and persistent knowledge, reframing the stack around orchestration rather than a single assistant replying to prompts.",
          impactArea: "method-or-proposal",
          citations: [cite(3, "Agent kernel"), cite(4, "Skills model")],
        },
        {
          label: "Practical credibility",
          text: "This is less concrete than the other briefs because it is mostly an architectural thesis, but it is still useful as a reference model for where workflow memory, knowledge graphs, and orchestration primitives could converge if agent platforms mature.",
          impactArea: "implementation",
          citations: [cite(5, "Architecture discussion"), cite(6, "Data ecosystem")],
        },
        {
          label: "Results",
          text: "There is no true headline result here, which is itself important: this is not a benchmark paper and does not prove near-term product readiness, so it should be read as a directional map of the stack rather than as evidence of immediate commercial advantage.",
          impactArea: "evidence",
          citations: [cite(5, "Architecture discussion"), cite(9, "Open challenges")],
        },
        {
          label: "Broader takeaway",
          text: "The broader takeaway is that if GenAI products evolve toward persistent agents and intent-driven software, the real strategic control points may shift toward orchestration, memory, permissions, and knowledge infrastructure rather than the chat interface alone.",
          impactArea: "assessment",
          citations: [cite(9, "Open challenges")],
        },
      ],
      confidenceNotes: [
        "Confidence is lower here because the paper is more conceptual than empirical.",
        "It still has strategy value because it surfaces where the next control points in the AI stack may emerge.",
      ],
      evidence: [
        {
          claim: "The agent kernel is positioned as the coordination substrate for an intent-driven interface.",
          impactArea: "stack",
          confidence: "medium",
          citations: [cite(3, "Agent kernel")],
        },
        {
          claim: "Knowledge discovery, workflow mining, and knowledge graphs are central to the proposed architecture.",
          impactArea: "training",
          confidence: "medium",
          citations: [cite(6, "Data ecosystem"), cite(7, "Workflow mining")],
        },
        {
          claim: "The paper is better interpreted as a research agenda than a proof of production readiness.",
          impactArea: "caveat",
          confidence: "high",
          citations: [cite(9, "Open challenges")],
        },
      ],
      sourceBasis: "full-pdf",
      usedFallbackAbstract: false,
    },
  },
];
