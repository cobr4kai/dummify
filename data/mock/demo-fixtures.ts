import type { PaperSourceRecord, StructuredPaperSummary } from "@/lib/types";

type DemoPaperFixture = {
  paper: PaperSourceRecord;
  summary: StructuredPaperSummary;
};

export const demoPaperFixtures: DemoPaperFixture[] = [
  {
    paper: {
      arxivId: "2603.08877",
      version: 1,
      versionedId: "2603.08877v1",
      title:
        "Quantifying the Accuracy and Cost Impact of Design Decisions in Budget-Constrained Agentic LLM Search",
      abstract:
        "Agentic Retrieval-Augmented Generation systems combine iterative search, planning prompts, and retrieval backends, but deployed settings impose explicit budgets on tool calls and completion tokens. We present a controlled measurement study of how search depth, retrieval strategy, and completion budget affect accuracy and cost under fixed constraints. Across models and datasets, accuracy improves with additional searches up to a small cap, hybrid lexical and dense retrieval with lightweight re-ranking produces the largest average gains in our ablation grid, and larger completion budgets are most helpful on synthesis-heavy tasks. These results provide practical guidance for configuring budgeted agentic retrieval pipelines and are accompanied by reproducible prompts and evaluation settings.",
      authors: ["Kyle McCleary", "James Ghawaly"],
      categories: ["cs.AI", "cs.IR"],
      sourceFeedCategories: ["cs.AI", "cs.IR"],
      primaryCategory: "cs.AI",
      publishedAt: new Date("2026-03-11T00:00:00.000Z"),
      updatedAt: new Date("2026-03-11T00:00:00.000Z"),
      announcementDay: "2026-03-11",
      announceType: "demo",
      comment: null,
      journalRef: null,
      doi: null,
      links: {
        abs: "https://arxiv.org/abs/2603.08877",
        pdf: "https://arxiv.org/pdf/2603.08877v1",
      },
      sourceMetadata: {
        sourceType: "demo",
      },
      sourcePayload: {
        note: "Seeded PaperBrief demo fixture",
      },
    },
    summary: {
      oneSentenceSummary:
        "This paper shows which agentic search design choices most improve answer quality before costs start rising faster than the gains.",
      whyThisMatters:
        "For teams experimenting with retrieval-heavy AI assistants, the paper offers practical evidence that some design knobs matter more than others. The business value is not a new model release but a clearer operating playbook for balancing accuracy, latency, and token spend when building search-driven copilots or research workflows.",
      audienceInterpretations: {
        strategy:
          "This is useful if you are deciding whether agentic search is a scalable product pattern or just a demo gimmick. The takeaway is that constrained, well-instrumented search loops can produce meaningful gains without unlimited compute.",
        finance:
          "The strongest finance angle is cost discipline. The paper suggests there is a point where more search or more completion budget stops paying back, which matters for AI margin models and internal usage controls.",
        procurement:
          "Procurement teams should read this as guidance for evaluating vendors that pitch agentic retrieval. Ask what they measure, how they cap usage, and whether their claimed gains come from smarter orchestration or simply more compute.",
      },
      whatThisIsNot:
        "This is not proof that every agentic RAG system is better than a simpler retrieval stack. It is a controlled study about design tradeoffs under budget constraints.",
      confidenceNotes: [
        "The paper appears to provide controlled comparisons, which is a stronger basis than anecdotal demos.",
        "The business implications are inferred from the abstract; deployment complexity and data quality constraints are not fully described here.",
      ],
      jargonBuster: [
        {
          term: "Agentic RAG",
          definition:
            "A retrieval system where the model can iteratively search, plan, and use tools instead of answering in one pass.",
        },
        {
          term: "Re-ranking",
          definition:
            "A lightweight step that reorders retrieved results so the most relevant items are shown first.",
        },
      ],
      keyClaims: [
        {
          claim:
            "Accuracy improves when the system is allowed to perform a limited number of additional searches.",
          supportLevel: "explicit",
        },
        {
          claim:
            "Hybrid retrieval with lightweight re-ranking seems to be the most attractive performance-cost tradeoff.",
          supportLevel: "explicit",
        },
        {
          claim:
            "Teams can likely improve enterprise search assistants more by better orchestration than by buying a larger model alone.",
          supportLevel: "inferred",
        },
      ],
      businessConsequences: [
        {
          consequence:
            "AI product teams may want explicit budget caps and search-step instrumentation before scaling agentic retrieval.",
          audience: "all",
          confidence: "high",
        },
        {
          consequence:
            "Finance leaders can use this framing to challenge AI usage growth that is not tied to measured quality gains.",
          audience: "finance",
          confidence: "medium",
        },
      ],
      maturityEstimate: "LIKELY_PRODUCTIZABLE",
      leadershipQuestions: [
        "Which retrieval and orchestration choices are actually driving quality in our current assistant stack?",
        "Where do we see diminishing returns in token spend or tool calls today?",
      ],
    },
  },
  {
    paper: {
      arxivId: "2603.08852",
      version: 1,
      versionedId: "2603.08852v1",
      title: "LDP: An Identity-Aware Protocol for Multi-Agent LLM Systems",
      abstract:
        "As multi-agent AI systems grow in complexity, the protocols connecting them constrain their capabilities. Current protocols do not expose model identity, reasoning profile, quality calibration, or cost characteristics as first-class primitives. We present the LLM Delegate Protocol, which introduces identity cards, negotiated payload modes, governed sessions, provenance tracking, and trust domains. Identity-aware routing lowers latency on easy tasks, payload optimization reduces token counts, and governed sessions eliminate significant token overhead. The paper contributes a protocol design, reference implementation, and evidence that AI-native protocol primitives enable more efficient and governable delegation.",
      authors: ["Sunil Prakash"],
      categories: ["cs.AI", "cs.SE"],
      sourceFeedCategories: ["cs.AI"],
      primaryCategory: "cs.AI",
      publishedAt: new Date("2026-03-11T00:00:00.000Z"),
      updatedAt: new Date("2026-03-11T00:00:00.000Z"),
      announcementDay: "2026-03-11",
      announceType: "demo",
      comment: null,
      journalRef: null,
      doi: null,
      links: {
        abs: "https://arxiv.org/abs/2603.08852",
        pdf: "https://arxiv.org/pdf/2603.08852v1",
      },
      sourceMetadata: {
        sourceType: "demo",
      },
      sourcePayload: {
        note: "Seeded PaperBrief demo fixture",
      },
    },
    summary: {
      oneSentenceSummary:
        "This paper argues that multi-agent AI systems need a protocol layer that explicitly communicates identity, cost, trust, and provenance instead of treating every model as interchangeable.",
      whyThisMatters:
        "If multi-agent AI moves from experimentation into enterprise workflows, protocol design becomes an operational control surface. This paper matters because it frames latency, governance, and security not as afterthoughts but as protocol-level design choices that could materially affect how enterprises buy, integrate, and control agent systems.",
      audienceInterpretations: {
        strategy:
          "This is strategically relevant because it hints at where enterprise agent platforms may differentiate: not only by model quality, but by the control plane they provide across many specialized agents.",
        finance:
          "The finance takeaway is that protocol-level design can change token overhead and latency, which means architecture choices can shift the unit economics of multi-agent systems.",
        procurement:
          "Procurement teams should care because protocol standards influence interoperability, lock-in, auditability, and the security posture of agent vendors.",
      },
      whatThisIsNot:
        "This is not a universal proof that multi-agent systems outperform simpler designs. It is a paper about a protocol architecture for governing and routing those systems more cleanly.",
      confidenceNotes: [
        "The abstract includes concrete efficiency and governance claims, which gives this more substance than a purely conceptual position paper.",
        "The broader market implications are inferred; adoption by major vendors or standards bodies is not established here.",
      ],
      jargonBuster: [
        {
          term: "Provenance",
          definition:
            "A record of where a result came from and what evidence or steps led to it.",
        },
        {
          term: "Trust domain",
          definition:
            "A boundary that determines which systems or agents are allowed to share information or take actions with each other.",
        },
      ],
      keyClaims: [
        {
          claim:
            "Identity-aware routing can reduce latency by directing tasks to the most suitable delegate.",
          supportLevel: "explicit",
        },
        {
          claim:
            "Governed sessions and structured payload handling can reduce token overhead without hurting quality.",
          supportLevel: "explicit",
        },
        {
          claim:
            "Protocol-level controls may become a key enterprise buying criterion for agent platforms.",
          supportLevel: "inferred",
        },
      ],
      businessConsequences: [
        {
          consequence:
            "Platform teams may need to evaluate agent frameworks partly as infrastructure governance products, not just model wrappers.",
          audience: "strategy",
          confidence: "medium",
        },
        {
          consequence:
            "Vendor due diligence may increasingly focus on protocol transparency, trust boundaries, and audit trails.",
          audience: "procurement",
          confidence: "high",
        },
      ],
      maturityEstimate: "INFRA_PLATFORM_RELEVANT",
      leadershipQuestions: [
        "If we deploy multiple agents, what protocol governs trust, cost controls, and traceability between them?",
        "Are our current agent vendors exposing enough control-plane information for enterprise oversight?",
      ],
    },
  },
  {
    paper: {
      arxivId: "2603.08938",
      version: 1,
      versionedId: "2603.08938v1",
      title:
        "AgentOS: From Application Silos to a Natural Language-Driven Data Ecosystem",
      abstract:
        "This paper proposes a Personal Agent Operating System in which traditional GUI desktops are replaced by a natural-language or voice portal. The system core becomes an Agent Kernel that interprets user intent, decomposes tasks, and coordinates multiple agents, while applications evolve into modular skills. The authors argue that building such an operating system is fundamentally a knowledge discovery and data mining problem involving workflow mining, recommendation, and evolving personal knowledge graphs.",
      authors: [
        "Rui Liu",
        "Tao Zhe",
        "Dongjie Wang",
        "Zijun Yao",
        "Kunpeng Liu",
        "Yanjie Fu",
        "Huan Liu",
        "Jian Pei",
      ],
      categories: ["cs.AI"],
      sourceFeedCategories: ["cs.AI"],
      primaryCategory: "cs.AI",
      publishedAt: new Date("2026-03-11T00:00:00.000Z"),
      updatedAt: new Date("2026-03-11T00:00:00.000Z"),
      announcementDay: "2026-03-11",
      announceType: "demo",
      comment: null,
      journalRef: null,
      doi: null,
      links: {
        abs: "https://arxiv.org/abs/2603.08938",
        pdf: "https://arxiv.org/pdf/2603.08938v1",
      },
      sourceMetadata: {
        sourceType: "demo",
      },
      sourcePayload: {
        note: "Seeded PaperBrief demo fixture",
      },
    },
    summary: {
      oneSentenceSummary:
        "This paper sketches an operating-system-level future where natural language becomes the main interface and software is orchestrated as modular agent skills.",
      whyThisMatters:
        "This is a high-level systems thesis rather than an incremental model paper. It matters because it points toward a possible shift in how enterprise software could be packaged and used: fewer app silos, more intent-driven orchestration, and greater dependence on knowledge graphs, permissions, and workflow mining.",
      audienceInterpretations: {
        strategy:
          "Strategy teams should see this as a directional signal about where user interfaces, software packaging, and workflow automation might be heading if agent systems mature.",
        finance:
          "Finance teams should treat this as speculative but useful for scenario planning around software spend, productivity claims, and infrastructure concentration if an agent kernel becomes a new platform layer.",
        procurement:
          "Procurement teams should read this as an early warning that vendor boundaries could shift from standalone apps to modular skills, orchestration layers, and permission systems.",
      },
      whatThisIsNot:
        "This is not evidence that agent operating systems are ready for production rollout today. It is a conceptual architecture and research agenda.",
      confidenceNotes: [
        "The abstract is more of a systems vision than a measured deployment study.",
        "Most commercial implications are inferred from the proposed architecture rather than directly validated results.",
      ],
      jargonBuster: [
        {
          term: "Agent Kernel",
          definition:
            "The core coordination layer that interprets requests, breaks them into tasks, and routes them across specialized agents.",
        },
        {
          term: "Knowledge graph",
          definition:
            "A structured map of entities and relationships that software can use to connect information and context.",
        },
      ],
      keyClaims: [
        {
          claim:
            "The operating system could evolve from app-centric interaction toward natural-language orchestration.",
          supportLevel: "explicit",
        },
        {
          claim:
            "Knowledge discovery and workflow mining become central system capabilities in this future architecture.",
          supportLevel: "explicit",
        },
        {
          claim:
            "If this model gains traction, software procurement may shift from applications toward skill ecosystems and orchestration platforms.",
          supportLevel: "inferred",
        },
      ],
      businessConsequences: [
        {
          consequence:
            "Enterprises may eventually evaluate AI platforms less as standalone assistants and more as workflow operating layers.",
          audience: "strategy",
          confidence: "medium",
        },
        {
          consequence:
            "Procurement teams may need new evaluation criteria for modular skills, permissions, and agent coordination products.",
          audience: "procurement",
          confidence: "medium",
        },
      ],
      maturityEstimate: "RESEARCH_ONLY",
      leadershipQuestions: [
        "Which parts of our workflow stack could realistically move from app-first to intent-first over the next two years?",
        "If software becomes modular agent skills, who owns permissions, auditing, and vendor accountability?",
      ],
    },
  },
];
