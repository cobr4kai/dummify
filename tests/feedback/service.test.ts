import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countMock,
  createMock,
  findManyMock,
} = vi.hoisted(() => ({
  countMock: vi.fn(),
  createMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    appFeedback: {
      count: countMock,
      create: createMock,
      findMany: findManyMock,
    },
  },
}));

import { createAppFeedback, getAppFeedbackSnapshot } from "@/lib/feedback/service";

describe("app feedback service", () => {
  beforeEach(() => {
    countMock.mockReset();
    createMock.mockReset();
    findManyMock.mockReset();
  });

  it("rejects invalid submissions without touching the database", async () => {
    await expect(createAppFeedback({
      sentiment: null,
      email: "bad-email",
    })).resolves.toEqual({
      status: "invalid",
    });

    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a feedback row with normalized email and sanitized path", async () => {
    createMock.mockResolvedValue({
      id: "feedback-1",
    });

    await expect(createAppFeedback({
      sentiment: "USEFUL",
      message: "  Helpful overall.  ",
      email: "Person@Example.com",
      sourcePath: "https://example.com/archive",
    })).resolves.toEqual({
      status: "success",
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        sentiment: "USEFUL",
        message: "Helpful overall.",
        email: "Person@Example.com",
        normalizedEmail: "person@example.com",
        sourcePath: null,
      },
    });
  });

  it("builds a feedback snapshot with counts and newest-first items", async () => {
    countMock
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    findManyMock.mockResolvedValue([
      {
        id: "feedback-2",
        sentiment: "NOT_USEFUL",
        message: "Confusing archive filters",
        email: null,
        normalizedEmail: null,
        sourcePath: "/archive",
        createdAt: new Date("2026-03-23T05:00:00.000Z"),
        updatedAt: new Date("2026-03-23T05:00:00.000Z"),
      },
    ]);

    const snapshot = await getAppFeedbackSnapshot();

    expect(snapshot.totalCount).toBe(4);
    expect(snapshot.usefulCount).toBe(3);
    expect(snapshot.notUsefulCount).toBe(1);
    expect(snapshot.withEmailCount).toBe(2);
    expect(snapshot.feedback).toHaveLength(1);
    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: [
        { createdAt: "desc" },
        { updatedAt: "desc" },
      ],
      take: 100,
    });
  });
});
