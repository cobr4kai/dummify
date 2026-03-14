import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countMock,
  createMock,
  findManyMock,
  findUniqueMock,
  updateMock,
} = vi.hoisted(() => ({
  countMock: vi.fn(),
  createMock: vi.fn(),
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    emailSignup: {
      count: countMock,
      create: createMock,
      findMany: findManyMock,
      findUnique: findUniqueMock,
      update: updateMock,
    },
  },
}));

import { createEmailSignup, getEmailSignupSnapshot } from "@/lib/signups/service";

describe("email signup service", () => {
  beforeEach(() => {
    countMock.mockReset();
    createMock.mockReset();
    findManyMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
  });

  it("rejects invalid email submissions without touching the database", async () => {
    await expect(createEmailSignup("not-an-email")).resolves.toEqual({
      status: "invalid",
    });

    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("creates a new signup for a first-time email", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({
      id: "signup-1",
    });

    await expect(createEmailSignup("  Person@Example.com  ")).resolves.toEqual({
      status: "success",
      wasExisting: false,
    });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        normalizedEmail: "person@example.com",
      },
      select: {
        id: true,
      },
    });
    expect(createMock).toHaveBeenCalledWith({
      data: {
        normalizedEmail: "person@example.com",
        email: "Person@Example.com",
      },
    });
  });

  it("updates the existing signup instead of creating a duplicate", async () => {
    findUniqueMock.mockResolvedValue({
      id: "signup-1",
    });
    updateMock.mockResolvedValue({
      id: "signup-1",
    });

    await expect(createEmailSignup("person@example.com")).resolves.toEqual({
      status: "success",
      wasExisting: true,
    });

    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: {
        normalizedEmail: "person@example.com",
      },
      data: {
        email: "person@example.com",
        submissionCount: {
          increment: 1,
        },
        lastSubmittedAt: expect.any(Date),
      },
    });
  });

  it("builds an admin snapshot with totals and repeat counts", async () => {
    countMock.mockResolvedValue(3);
    findManyMock.mockResolvedValue([
      {
        id: "signup-1",
        email: "first@example.com",
        normalizedEmail: "first@example.com",
        submissionCount: 1,
        createdAt: new Date("2026-03-13T18:00:00.000Z"),
        lastSubmittedAt: new Date("2026-03-13T18:00:00.000Z"),
      },
      {
        id: "signup-2",
        email: "repeat@example.com",
        normalizedEmail: "repeat@example.com",
        submissionCount: 4,
        createdAt: new Date("2026-03-13T19:00:00.000Z"),
        lastSubmittedAt: new Date("2026-03-13T19:30:00.000Z"),
      },
    ]);

    const snapshot = await getEmailSignupSnapshot();

    expect(snapshot.totalCount).toBe(3);
    expect(snapshot.repeatSignupCount).toBe(1);
    expect(snapshot.signups).toHaveLength(2);
    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: [
        { lastSubmittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 100,
    });
  });
});
