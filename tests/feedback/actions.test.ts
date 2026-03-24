import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAppFeedbackMock,
  redirectMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  createAppFeedbackMock: vi.fn(),
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

vi.mock("@/lib/feedback/service", () => ({
  createAppFeedback: createAppFeedbackMock,
}));

import { submitFeedbackAction } from "@/app/feedback/actions";

describe("submitFeedbackAction", () => {
  beforeEach(() => {
    createAppFeedbackMock.mockReset();
    redirectMock.mockClear();
    revalidatePathMock.mockReset();
  });

  it("redirects invalid submissions back to the feedback page", async () => {
    createAppFeedbackMock.mockResolvedValue({
      status: "invalid",
    });

    const formData = new FormData();
    formData.set("email", "bad-email");

    await expect(submitFeedbackAction(formData)).rejects.toThrow("REDIRECT:/feedback?status=invalid");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("revalidates the public and admin feedback pages after success", async () => {
    createAppFeedbackMock.mockResolvedValue({
      status: "success",
    });

    const formData = new FormData();
    formData.set("sentiment", "USEFUL");

    await expect(submitFeedbackAction(formData)).rejects.toThrow("REDIRECT:/feedback?status=success");
    expect(revalidatePathMock).toHaveBeenCalledWith("/feedback");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/feedback");
  });
});
