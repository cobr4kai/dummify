import { describe, expect, it, vi } from "vitest";

const { cookiesMock, redirectMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { requireAdmin } from "@/lib/auth";

describe("requireAdmin", () => {
  it("redirects unauthenticated users to login before admin mutations", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    });

    await expect(requireAdmin("/admin")).rejects.toThrow(
      "REDIRECT:/login?next=%2Fadmin",
    );
    expect(redirectMock).toHaveBeenCalledWith("/login?next=%2Fadmin");
  });
});
