import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirectMock,
  refetchPaperSourceMock,
  requireAdminMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  refetchPaperSourceMock: vi.fn(),
  requireAdminMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/briefs", () => ({
  getCanonicalPaperPathById: vi.fn(async (paperId: string) => `/papers/${paperId}`),
  getPublicBriefByPaperId: vi.fn(async () => null),
  getWeekPath: vi.fn((weekStart: string) => `/weeks/${weekStart}`),
}));

vi.mock("@/lib/papers/refetch", () => ({
  refetchPaperSource: refetchPaperSourceMock,
}));

vi.mock("@/lib/technical/service", () => ({
  ensurePaperTechnicalBrief: vi.fn(),
  getCurrentTechnicalBrief: vi.fn(),
  revertManualTechnicalBriefEdits: vi.fn(),
  saveManualTechnicalBriefEdits: vi.fn(),
}));

import { refetchPaperSourceAction } from "@/app/papers/[paperId]/actions";

describe("refetchPaperSourceAction", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    refetchPaperSourceMock.mockReset();
    requireAdminMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it("redirects to the paper detail page with the refetch success notice", async () => {
    const formData = new FormData();
    formData.set("paperId", "paper-1");
    refetchPaperSourceMock.mockResolvedValue({
      status: "metadata-refreshed-pdf-extracted",
      versionChanged: true,
    });

    await expect(refetchPaperSourceAction(formData)).rejects.toThrow(
      "REDIRECT:/papers/paper-1?notice=paper-source-refetched-pdf-extracted&versionChanged=1",
    );

    expect(requireAdminMock).toHaveBeenCalledWith("/papers/paper-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/archive");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
    expect(revalidatePathMock).toHaveBeenCalledWith("/papers/paper-1");
  });

  it("redirects with the failure notice when refetching does not succeed", async () => {
    const formData = new FormData();
    formData.set("paperId", "paper-1");
    refetchPaperSourceMock.mockResolvedValue({
      status: "arxiv-record-missing",
      versionChanged: false,
    });

    await expect(refetchPaperSourceAction(formData)).rejects.toThrow(
      "REDIRECT:/papers/paper-1?notice=paper-source-refetch-failed",
    );
  });
});
