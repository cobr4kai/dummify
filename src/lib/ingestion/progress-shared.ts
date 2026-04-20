import { IngestionMode } from "@prisma/client";

export const INGESTION_PHASES = [
  "discover_feeds",
  "fetch_historical_window",
  "hydrate_arxiv_records",
  "upsert_papers",
  "generate_briefs",
  "enrich_openalex",
  "enrich_structured_metadata",
  "score_papers",
  "complete",
] as const;

export type IngestionPhaseKey = (typeof INGESTION_PHASES)[number];
export type IngestionPhaseStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export type IngestionPhaseProgress = {
  key: IngestionPhaseKey;
  label: string;
  status: IngestionPhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  processed: number | null;
  total: number | null;
  message: string | null;
};

export type IngestionProgress = {
  schemaVersion: 1;
  currentPhase: IngestionPhaseKey | null;
  currentMessage: string | null;
  progressPercent: number;
  warningsCount: number;
  lastHeartbeatAt: string;
  phases: IngestionPhaseProgress[];
};

export type AdminIngestionRun = {
  id: string;
  status: string;
  mode: string;
  triggerSource: string;
  startedAt: string;
  completedAt: string | null;
  fetchedCount: number;
  upsertedCount: number;
  scoreCount: number;
  summaryCount: number;
  logLines: string[];
  progress: IngestionProgress | null;
  errorMessage: string | null;
};

export const PHASE_LABELS: Record<IngestionPhaseKey, string> = {
  discover_feeds: "Discover feeds",
  fetch_historical_window: "Fetch historical windows",
  hydrate_arxiv_records: "Hydrate arXiv records",
  upsert_papers: "Upsert papers",
  generate_briefs: "Generate briefs",
  enrich_openalex: "Enrich OpenAlex",
  enrich_structured_metadata: "Enrich structured metadata",
  score_papers: "Score papers",
  complete: "Complete",
};

export function createInitialIngestionProgress(mode: IngestionMode): IngestionProgress {
  const now = new Date().toISOString();

  const phases = INGESTION_PHASES.map<IngestionPhaseProgress>((key) => ({
    key,
    label: PHASE_LABELS[key],
    status: shouldSkipPhase(mode, key) ? "skipped" : "pending",
    startedAt: null,
    completedAt: shouldSkipPhase(mode, key) ? now : null,
    processed: null,
    total: null,
    message: shouldSkipPhase(mode, key) ? getSkippedMessage(mode, key) : null,
  }));

  return {
    schemaVersion: 1,
    currentPhase: null,
    currentMessage: null,
    progressPercent: 0,
    warningsCount: 0,
    lastHeartbeatAt: now,
    phases,
  };
}

export function parseIngestionProgress(value: unknown): IngestionProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<IngestionProgress>;
  if (!Array.isArray(candidate.phases) || candidate.schemaVersion !== 1) {
    return null;
  }

  const phases = candidate.phases
    .map((phase) => {
      if (!phase || typeof phase !== "object") {
        return null;
      }

      const typedPhase = phase as Partial<IngestionPhaseProgress>;
      if (!typedPhase.key || !INGESTION_PHASES.includes(typedPhase.key) || !typedPhase.status) {
        return null;
      }

      return {
        key: typedPhase.key,
        label: typeof typedPhase.label === "string" ? typedPhase.label : PHASE_LABELS[typedPhase.key],
        status: typedPhase.status,
        startedAt: typeof typedPhase.startedAt === "string" ? typedPhase.startedAt : null,
        completedAt: typeof typedPhase.completedAt === "string" ? typedPhase.completedAt : null,
        processed: typeof typedPhase.processed === "number" ? typedPhase.processed : null,
        total: typeof typedPhase.total === "number" ? typedPhase.total : null,
        message: typeof typedPhase.message === "string" ? typedPhase.message : null,
      } satisfies IngestionPhaseProgress;
    })
    .filter((phase): phase is IngestionPhaseProgress => phase !== null);

  if (phases.length === 0) {
    return null;
  }

  return {
    schemaVersion: 1,
    currentPhase:
      typeof candidate.currentPhase === "string" &&
      INGESTION_PHASES.includes(candidate.currentPhase as IngestionPhaseKey)
        ? (candidate.currentPhase as IngestionPhaseKey)
        : null,
    currentMessage: typeof candidate.currentMessage === "string" ? candidate.currentMessage : null,
    progressPercent: typeof candidate.progressPercent === "number" ? candidate.progressPercent : 0,
    warningsCount: typeof candidate.warningsCount === "number" ? candidate.warningsCount : 0,
    lastHeartbeatAt:
      typeof candidate.lastHeartbeatAt === "string"
        ? candidate.lastHeartbeatAt
        : new Date().toISOString(),
    phases,
  };
}

export function getRenderablePhaseTimeline(progress: IngestionProgress | null) {
  if (!progress) {
    return [];
  }

  return progress.phases.filter((phase) => phase.status !== "skipped");
}

function shouldSkipPhase(mode: IngestionMode, phaseKey: IngestionPhaseKey) {
  if (mode === IngestionMode.DAILY) {
    return phaseKey === "fetch_historical_window";
  }

  return phaseKey === "discover_feeds" || phaseKey === "generate_briefs";
}

function getSkippedMessage(mode: IngestionMode, phaseKey: IngestionPhaseKey) {
  if (mode === IngestionMode.DAILY && phaseKey === "fetch_historical_window") {
    return "Daily ingest does not use historical windows.";
  }

  if (mode === IngestionMode.HISTORICAL && phaseKey === "discover_feeds") {
    return "Historical ingest does not scan the live RSS feeds.";
  }

  if (mode === IngestionMode.HISTORICAL && phaseKey === "generate_briefs") {
    return "Historical backfills do not generate homepage briefs.";
  }

  return "Skipped for this ingest mode.";
}
