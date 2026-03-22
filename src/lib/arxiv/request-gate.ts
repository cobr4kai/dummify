import { prisma } from "@/lib/db";

export type ArxivLane = "api" | "rss";

export type ArxivRequestGate = {
  waitForTurn(lane: ArxivLane, minDelayMs: number): Promise<void>;
};

type GateDependencies = {
  nowFn?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
};

const GATE_SETTING_KEYS: Record<ArxivLane, string> = {
  api: "arxivApiNextAllowedAtMs",
  rss: "arxivRssNextAllowedAtMs",
};

const GATE_SETTING_DESCRIPTIONS: Record<ArxivLane, string> = {
  api: "Shared arXiv export API request gate used to keep metadata requests at or below the current 3-second policy across web and cron processes.",
  rss: "Shared arXiv RSS request gate used to keep metadata requests at or below the current 3-second policy across web and cron processes.",
};

class PrismaArxivRequestGate implements ArxivRequestGate {
  private readonly nowFn: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly queueByLane = new Map<ArxivLane, Promise<void>>();

  constructor(dependencies: GateDependencies = {}) {
    this.nowFn = dependencies.nowFn ?? Date.now;
    this.sleepFn = dependencies.sleepFn ?? sleep;
  }

  async waitForTurn(lane: ArxivLane, minDelayMs: number) {
    const queued = this.queueByLane.get(lane) ?? Promise.resolve();
    const next = queued.then(() => this.reserveSlot(lane, minDelayMs));
    this.queueByLane.set(
      lane,
      next.catch(() => {}),
    );
    return next;
  }

  private async reserveSlot(lane: ArxivLane, minDelayMs: number) {
    const nowMs = this.nowFn();
    const reservedAt = await prisma.$transaction(async (tx) => {
      const key = GATE_SETTING_KEYS[lane];
      const existing = await tx.appSetting.findUnique({
        where: { key },
      });
      const nextAllowedAt = parseNextAllowedAt(existing?.value);
      const slotStart = Math.max(nowMs, nextAllowedAt);

      await tx.appSetting.upsert({
        where: { key },
        update: {
          value: slotStart + minDelayMs,
          description: GATE_SETTING_DESCRIPTIONS[lane],
        },
        create: {
          key,
          value: slotStart + minDelayMs,
          description: GATE_SETTING_DESCRIPTIONS[lane],
        },
      });

      return slotStart;
    });

    const delay = Math.max(0, reservedAt - this.nowFn());
    if (delay > 0) {
      await this.sleepFn(delay);
    }
  }
}

let defaultGate: ArxivRequestGate | null = null;

export function createArxivRequestGate(dependencies: GateDependencies = {}) {
  return new PrismaArxivRequestGate(dependencies);
}

export function getDefaultArxivRequestGate() {
  defaultGate ??= createArxivRequestGate();
  return defaultGate;
}

function parseNextAllowedAt(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
