import { IngestionMode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toJsonInput } from "@/lib/utils/prisma";

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

const PHASE_LABELS: Record<IngestionPhaseKey, string> = {
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

const DEFAULT_FLUSH_INTERVAL_MS = 1500;

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
      if (
        !typedPhase.key ||
        !INGESTION_PHASES.includes(typedPhase.key) ||
        !typedPhase.status
      ) {
        return null;
      }

      return {
        key: typedPhase.key,
        label: typeof typedPhase.label === "string" ? typedPhase.label : PHASE_LABELS[typedPhase.key],
        status: typedPhase.status,
        startedAt: typeof typedPhase.startedAt === "string" ? typedPhase.startedAt : null,
        completedAt: typeof typedPhase.completedAt === "string" ? typedPhase.completedAt : null,
        processed:
          typeof typedPhase.processed === "number" ? typedPhase.processed : null,
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
    currentMessage:
      typeof candidate.currentMessage === "string" ? candidate.currentMessage : null,
    progressPercent:
      typeof candidate.progressPercent === "number" ? candidate.progressPercent : 0,
    warningsCount:
      typeof candidate.warningsCount === "number" ? candidate.warningsCount : 0,
    lastHeartbeatAt:
      typeof candidate.lastHeartbeatAt === "string"
        ? candidate.lastHeartbeatAt
        : new Date().toISOString(),
    phases,
  };
}

export function normalizeAdminIngestionRun(
  run: Prisma.IngestionRunGetPayload<Record<string, never>> & {
    progressJson: unknown;
  },
): AdminIngestionRun {
  return {
    id: run.id,
    status: run.status,
    mode: run.mode,
    triggerSource: run.triggerSource,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    fetchedCount: run.fetchedCount,
    upsertedCount: run.upsertedCount,
    scoreCount: run.scoreCount,
    summaryCount: run.summaryCount,
    logLines: Array.isArray(run.logLines)
      ? run.logLines
          .filter((line): line is string | number | boolean => line !== null)
          .map((line) => String(line))
      : [],
    progress: parseIngestionProgress(run.progressJson),
    errorMessage: run.errorMessage ?? null,
  };
}

export function getRenderablePhaseTimeline(progress: IngestionProgress | null) {
  if (!progress) {
    return [];
  }

  return progress.phases.filter((phase) => phase.status !== "skipped");
}

export class IngestionProgressReporter {
  private progress: IngestionProgress;
  private lastFlushMs = 0;

  constructor(
    private readonly runId: string,
    mode: IngestionMode,
  ) {
    this.progress = createInitialIngestionProgress(mode);
  }

  snapshot() {
    return this.progress;
  }

  async initialize() {
    await this.flush(true);
  }

  async startPhase(
    phaseKey: IngestionPhaseKey,
    input: {
      message?: string | null;
      total?: number | null;
      processed?: number | null;
    } = {},
  ) {
    const phase = this.getPhase(phaseKey);
    phase.status = "running";
    phase.startedAt = phase.startedAt ?? new Date().toISOString();
    phase.completedAt = null;
    phase.message = input.message ?? phase.message;
    phase.total = typeof input.total === "number" ? input.total : phase.total;
    phase.processed =
      typeof input.processed === "number" ? input.processed : phase.processed;
    this.progress.currentPhase = phaseKey;
    this.progress.currentMessage = input.message ?? phase.message ?? null;
    this.recalculateProgress();
    await this.flush(true);
  }

  async updatePhase(
    phaseKey: IngestionPhaseKey,
    input: {
      message?: string | null;
      total?: number | null;
      processed?: number | null;
      force?: boolean;
    } = {},
  ) {
    const phase = this.getPhase(phaseKey);
    if (phase.status === "pending") {
      phase.status = "running";
      phase.startedAt = phase.startedAt ?? new Date().toISOString();
    }

    if (typeof input.total === "number") {
      phase.total = input.total;
    }

    if (typeof input.processed === "number") {
      phase.processed = input.processed;
    }

    if (typeof input.message === "string") {
      phase.message = input.message;
      this.progress.currentMessage = input.message;
    }

    this.progress.currentPhase = phaseKey;
    this.recalculateProgress();
    await this.flush(Boolean(input.force));
  }

  async completePhase(
    phaseKey: IngestionPhaseKey,
    message?: string | null,
  ) {
    const phase = this.getPhase(phaseKey);
    phase.status = "completed";
    phase.startedAt = phase.startedAt ?? new Date().toISOString();
    phase.completedAt = new Date().toISOString();
    if (phase.total !== null && phase.processed === null) {
      phase.processed = phase.total;
    }
    if (typeof message === "string") {
      phase.message = message;
      this.progress.currentMessage = message;
    }
    this.progress.currentPhase = phaseKey;
    this.recalculateProgress();
    await this.flush(true);
  }

  async setWaitingMessage(
    phaseKey: IngestionPhaseKey,
    message: string,
    force = true,
  ) {
    const phase = this.getPhase(phaseKey);
    if (phase.status === "pending") {
      phase.status = "running";
      phase.startedAt = new Date().toISOString();
    }
    phase.message = message;
    this.progress.currentPhase = phaseKey;
    this.progress.currentMessage = message;
    this.recalculateProgress();
    await this.flush(force);
  }

  async addWarnings(count: number, message?: string | null) {
    this.progress.warningsCount += count;
    if (typeof message === "string") {
      this.progress.currentMessage = message;
      const currentPhase = this.progress.currentPhase;
      if (currentPhase) {
        this.getPhase(currentPhase).message = message;
      }
    }
    await this.flush(true);
  }

  async markFailed(message: string) {
    const currentPhaseKey =
      this.progress.currentPhase ??
      this.progress.phases.find((phase) => phase.status === "running")?.key ??
      null;

    if (currentPhaseKey) {
      const phase = this.getPhase(currentPhaseKey);
      phase.status = "failed";
      phase.startedAt = phase.startedAt ?? new Date().toISOString();
      phase.completedAt = new Date().toISOString();
      phase.message = message;
    }

    this.progress.currentPhase = currentPhaseKey;
    this.progress.currentMessage = message;
    this.recalculateProgress();
    await this.flush(true);
  }

  async finish(message: string) {
    await this.startPhase("complete", { message, total: 1, processed: 0 });
    await this.completePhase("complete", message);
  }

  private recalculateProgress() {
    const phases = this.progress.phases.filter((phase) => phase.status !== "skipped");
    if (phases.length === 0) {
      this.progress.progressPercent = 100;
      return;
    }

    let phaseCompletion = 0;
    for (const phase of phases) {
      if (phase.status === "completed") {
        phaseCompletion += 1;
        continue;
      }

      if (
        phase.status === "running" &&
        typeof phase.processed === "number" &&
        typeof phase.total === "number" &&
        phase.total > 0
      ) {
        phaseCompletion += Math.min(phase.processed / phase.total, 0.98);
      }
    }

    this.progress.progressPercent = Math.max(
      0,
      Math.min(100, Math.round((phaseCompletion / phases.length) * 100)),
    );
  }

  private getPhase(phaseKey: IngestionPhaseKey) {
    const phase = this.progress.phases.find((item) => item.key === phaseKey);
    if (!phase) {
      throw new Error(`Missing ingestion progress phase: ${phaseKey}`);
    }

    return phase;
  }

  private async flush(force = false) {
    const now = Date.now();
    if (!force && now - this.lastFlushMs < DEFAULT_FLUSH_INTERVAL_MS) {
      return;
    }

    this.progress.lastHeartbeatAt = new Date().toISOString();
    await prisma.ingestionRun.update({
      where: { id: this.runId },
      data: {
        progressJson: toJsonInput(this.progress),
      },
    });
    this.lastFlushMs = now;
  }
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
