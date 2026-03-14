import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createEmailSignupMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  createEmailSignupMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/signups/service", () => ({
  createEmailSignup: createEmailSignupMock,
}));

import { signupAction } from "@/app/actions";

describe("signupAction", () => {
  beforeEach(() => {
    createEmailSignupMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockReset();
  });

  it("redirects invalid submissions back to the homepage with an error state", async () => {
    createEmailSignupMock.mockResolvedValue({
      status: "invalid",
    });

    const formData = new FormData();
    formData.set("email", "bad-email");

    await expect(signupAction(formData)).rejects.toThrow("REDIRECT:/?signup=invalid");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("revalidates the homepage and admin signups page after a successful submit", async () => {
    createEmailSignupMock.mockResolvedValue({
      status: "success",
      wasExisting: false,
    });

    const formData = new FormData();
    formData.set("email", "person@example.com");

    await expect(signupAction(formData)).rejects.toThrow("REDIRECT:/?signup=success");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/signups");
  });
});
