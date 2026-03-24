import { beforeEach, describe, expect, it, vi } from "vitest";

const { appSettingState, findUniqueMock, transactionMock, upsertMock } = vi.hoisted(() => {
  const state = new Map<string, number>();
  const findUnique = vi.fn(async ({ where }: { where: { key: string } }) => {
    const value = state.get(where.key);
    return typeof value === "number" ? { key: where.key, value } : null;
  });
  const upsert = vi.fn(async ({
    create,
    update,
    where,
  }: {
    create: { value: number };
    update: { value: number };
    where: { key: string };
  }) => {
    const nextValue = typeof update.value === "number" ? update.value : create.value;
    state.set(where.key, nextValue);
    return {
      key: where.key,
      value: nextValue,
    };
  });
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({
      appSetting: {
        findUnique,
        upsert,
      },
    }),
  );

  return {
    appSettingState: state,
    findUniqueMock: findUnique,
    transactionMock: transaction,
    upsertMock: upsert,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { createArxivRequestGate } from "@/lib/arxiv/request-gate";

describe("PrismaArxivRequestGate", () => {
  beforeEach(() => {
    appSettingState.clear();
    findUniqueMock.mockClear();
    transactionMock.mockClear();
    upsertMock.mockClear();
  });

  it("serializes same-lane reservations and persists the next allowed timestamp", async () => {
    let nowMs = 1_000;
    const sleepMock = vi.fn(async (ms: number) => {
      nowMs += ms;
    });
    const gate = createArxivRequestGate({
      nowFn: () => nowMs,
      sleepFn: sleepMock,
    });

    await Promise.all([
      gate.waitForTurn("api", 3_000),
      gate.waitForTurn("api", 3_000),
    ]);

    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(sleepMock.mock.calls.map(([delay]) => delay)).toEqual([3_000]);
    expect(appSettingState.get("arxivApiNextAllowedAtMs")).toBe(7_000);
  });

  it("extends the shared cooldown when a penalty is applied", async () => {
    let nowMs = 1_000;
    const gate = createArxivRequestGate({
      nowFn: () => nowMs,
      sleepFn: vi.fn(async () => {}),
    });

    await gate.waitForTurn("api", 3_000);
    nowMs = 1_500;
    await gate.applyPenalty("api", 12_000);

    expect(appSettingState.get("arxivApiNextAllowedAtMs")).toBe(13_500);
  });
});
