import { describe, expect, it } from "vitest";
import { sanitizeInternalPath } from "@/lib/utils/redirect";

describe("sanitizeInternalPath", () => {
  it("keeps relative in-app paths", () => {
    expect(sanitizeInternalPath("/admin?tab=settings")).toBe("/admin?tab=settings");
  });

  it("falls back for external targets", () => {
    expect(sanitizeInternalPath("https://attacker.example")).toBe("/admin");
    expect(sanitizeInternalPath("//attacker.example")).toBe("/admin");
  });
});
