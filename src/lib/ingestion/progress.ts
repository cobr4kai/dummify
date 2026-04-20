import { type IngestionMode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createInitialIngestionProgress,
  type AdminIngestionRun,
  type IngestionPhaseKey,
  type IngestionProgress,
  INGESTION_PHASES,
  parseIngestionProgress,
} from "@/lib/ingestion/progress-shared";
import { toJsonInput } from "@/lib/utils/prisma";

const DEFAULT_FLUSH_INTERVAL_MS = 1500;

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

export {
  createInitialIngestionProgress,
  parseIngestionProgress,
} from "@/lib/ingestion/progress-shared";

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
