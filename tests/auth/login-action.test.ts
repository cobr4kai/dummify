import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirectMock,
  isAdminConfiguredMock,
  setAdminSessionMock,
  verifyAdminPasswordMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  isAdminConfiguredMock: vi.fn(),
  setAdminSessionMock: vi.fn(),
  verifyAdminPasswordMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  isAdminConfigured: isAdminConfiguredMock,
  setAdminSession: setAdminSessionMock,
  verifyAdminPassword: verifyAdminPasswordMock,
}));

import { loginAction } from "@/app/login/actions";

describe("loginAction", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    isAdminConfiguredMock.mockReset();
    setAdminSessionMock.mockReset();
    verifyAdminPasswordMock.mockReset();
  });

  it("falls back to /admin for external next targets", async () => {
    isAdminConfiguredMock.mockReturnValue(true);
    verifyAdminPasswordMock.mockReturnValue(true);
    setAdminSessionMock.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("password", "secret");
    formData.set("next", "https://attacker.example");

    await expect(loginAction(formData)).rejects.toThrow("REDIRECT:/admin");
    expect(setAdminSessionMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/admin");
  });

  it("surfaces missing admin configuration before attempting login", async () => {
    isAdminConfiguredMock.mockReturnValue(false);

    const formData = new FormData();
    formData.set("password", "secret");
    formData.set("next", "/admin");

    await expect(loginAction(formData)).rejects.toThrow(
      "REDIRECT:/login?error=unconfigured&next=%2Fadmin",
    );
    expect(setAdminSessionMock).not.toHaveBeenCalled();
  });
});
