import { describe, expect, it } from "vitest";
import { formatShortDate, isExpectedQuietAnnouncementDay } from "@/lib/utils/dates";

describe("formatShortDate", () => {
  it("preserves calendar dates stored as YYYY-MM-DD strings", () => {
    expect(formatShortDate("2026-03-11")).toBe("Mar 11, 2026");
  });

  it("treats Friday and Saturday as expected quiet arXiv announcement days", () => {
    expect(isExpectedQuietAnnouncementDay("2026-03-13")).toBe(true);
    expect(isExpectedQuietAnnouncementDay("2026-03-14")).toBe(true);
    expect(isExpectedQuietAnnouncementDay("2026-03-11")).toBe(false);
  });
});
