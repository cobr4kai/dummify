import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getEmailSignupSnapshotMock,
  requireAdminMock,
} = vi.hoisted(() => ({
  getEmailSignupSnapshotMock: vi.fn(),
  requireAdminMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/signups/service", () => ({
  getEmailSignupSnapshot: getEmailSignupSnapshotMock,
}));

import AdminSignupsPage from "@/app/admin/signups/page";

describe("AdminSignupsPage", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    getEmailSignupSnapshotMock.mockReset();
    requireAdminMock.mockResolvedValue(undefined);
    getEmailSignupSnapshotMock.mockResolvedValue({
      totalCount: 0,
      repeatSignupCount: 0,
      signups: [],
    });
  });

  it("requires admin access for the dedicated signups route", async () => {
    await AdminSignupsPage();

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/signups");
    expect(getEmailSignupSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
