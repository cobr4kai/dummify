import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAppFeedbackSnapshotMock,
  requireAdminMock,
} = vi.hoisted(() => ({
  getAppFeedbackSnapshotMock: vi.fn(),
  requireAdminMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/feedback/service", () => ({
  getAppFeedbackSnapshot: getAppFeedbackSnapshotMock,
}));

import AdminFeedbackPage from "@/app/admin/feedback/page";

describe("AdminFeedbackPage", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    getAppFeedbackSnapshotMock.mockReset();
    requireAdminMock.mockResolvedValue(undefined);
    getAppFeedbackSnapshotMock.mockResolvedValue({
      totalCount: 2,
      usefulCount: 1,
      notUsefulCount: 1,
      withEmailCount: 1,
      feedback: [],
    });
  });

  it("requires admin access and loads the feedback snapshot", async () => {
    await AdminFeedbackPage();

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/feedback");
    expect(getAppFeedbackSnapshotMock).toHaveBeenCalledWith();
  });
});
