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
        "This paper suggests the next useful gains in AI search may come from orchestration, not just bigger models. The authors show that a small number of extra searches, hybrid retrieval, and light re-ranking can improve results before costs start rising faster than the benefit. If that pattern holds in production, product and finance teams should rethink the assumption that quality gains require immediately moving to a more expensive model tier.",
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
        "Some of the next practical quality gains in GenAI search may come from better orchestration and tighter budget controls, not just higher model spend.",
      whatToIgnore:
        "This does not prove every search-heavy workflow should add more orchestration complexity or that model upgrades stop mattering.",
      bullets: [
        {
          label: "Where leverage moves",
          text: "The leverage point here is system design, not model weights alone. Teams building research assistants or enterprise search copilots may get a better near-term return from tuning search depth, retrieval mix, and budget caps than from buying a larger model by default.",
          impactArea: "implication",
          citations: [cite(1, "Abstract"), cite(6, "Main results")],
        },
        {
          label: "What to ask vendors",
          text: "Ask vendors which part of their quality lift comes from orchestration versus raw model size. If they cannot show where search depth, re-ranking, or budget controls actually change results, you may be paying for more compute rather than smarter design.",
          impactArea: "vendor-question",
          citations: [cite(3, "Method"), cite(5, "System design")],
        },
        {
          label: "What to watch next",
          text: "The adoption signal to watch is whether these gains survive messier enterprise data and real usage budgets. If the effect persists outside benchmark-style datasets, this becomes a practical operating playbook rather than a lab optimization.",
          impactArea: "adoption-signal",
          citations: [cite(6, "Cost-quality tradeoff"), cite(7, "Ablation grid")],
        },
        {
          label: "What still limits it",
          text: "This is still a bounded optimization result, not proof that every agentic RAG stack should become more complex. The paper matters most if your workflow is already search-heavy and your margins are sensitive to tool-call and token costs.",
          impactArea: "limitation",
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
        "This paper argues that the next bottleneck in multi-agent AI may be the handoff layer, not the model itself. By making identity, trust, provenance, and payload choices explicit in the protocol, the authors show a plausible route to lower latency and token overhead. If that idea spreads, competition among agent platforms could move toward control-plane quality and governance features rather than headline model performance alone.",
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
        "If multi-agent systems become more common, protocol design could become a meaningful cost, control, and interoperability lever.",
      whatToIgnore:
        "This is not proof that multi-agent architectures automatically improve end-user outcomes or are the default enterprise answer.",
      bullets: [
        {
          label: "Where this bites",
          text: "If multi-agent systems keep spreading, protocol design becomes an operating-cost and governance lever. That shifts attention from 'which model is best' to how work moves, how context is packaged, and how actions are audited across agents.",
          impactArea: "implication",
          citations: [cite(1, "Abstract"), cite(2, "Protocol overview")],
        },
        {
          label: "What to ask vendors",
          text: "Ask vendors what their agent handoff protocol exposes about cost, routing, provenance, and trust boundaries. If those controls are opaque, you may be buying lock-in and governance risk along with the product.",
          impactArea: "vendor-question",
          citations: [cite(3, "Identity cards"), cite(4, "Trust domains")],
        },
        {
          label: "What to watch next",
          text: "Watch whether major frameworks or standards bodies start treating these protocol primitives as defaults rather than optional extras. That would be a stronger market-readiness signal than one isolated research implementation.",
          impactArea: "watch",
          citations: [cite(5, "Reference implementation"), cite(8, "Platform implications")],
        },
        {
          label: "What still limits it",
          text: "The evidence here is strongest on efficiency and control, not on dramatic quality improvement. That makes the paper more relevant to platform, security, and infrastructure teams than to anyone expecting a sudden leap in end-user outcomes.",
          impactArea: "limitation",
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
        "This is not an operating manual for deploying agent operating systems tomorrow; it is a directional paper about where software interfaces could move if agent platforms mature. The important idea is that the center of gravity shifts from standalone apps to orchestration, memory, permissions, and persistent knowledge. That challenges the assumption that AI's long-term value will sit mainly in the chat interface rather than in the control layer underneath it.",
      keyStats: [],
      focusTags: ["agents", "infra", "data"],
      whyItMatters:
        "The paper is useful because it frames a possible future stack where orchestration, memory, and permissions become the real product surface.",
      whatToIgnore:
        "This is still a research agenda and architecture thesis, not evidence of near-term enterprise readiness.",
      bullets: [
        {
          label: "Where value could move",
          text: "If this thesis is right, workflow software starts to look more like a skill ecosystem attached to an orchestration layer than a bundle of standalone applications. That would change where platform power, switching costs, and integration value accumulate.",
          impactArea: "implication",
          citations: [cite(1, "Abstract"), cite(2, "System vision")],
        },
        {
          label: "Assumption to revisit",
          text: "Revisit the assumption that adding an assistant on top of existing apps is the end state. The paper points toward a deeper stack shift in which intent routing, memory, and knowledge graphs become the real product surface.",
          impactArea: "assumption",
          citations: [cite(3, "Agent kernel"), cite(4, "Skills model")],
        },
        {
          label: "What to watch next",
          text: "The adoption signal to watch is not more demos; it is whether vendors start shipping durable memory, permissioning, workflow mining, and cross-tool orchestration as tightly integrated features. Without that infrastructure, the vision stays conceptual.",
          impactArea: "adoption-signal",
          citations: [cite(5, "Architecture discussion"), cite(6, "Data ecosystem"), cite(7, "Workflow mining")],
        },
        {
          label: "What still limits it",
          text: "This remains early and under-evidenced as a product thesis. It is useful for scenario planning and platform strategy, but not yet a reason to budget for near-term enterprise rollout.",
          impactArea: "limitation",
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
