import { describe, expect, it } from "vitest";
import {
  formatWeekLabel,
  formatWeekRange,
  getCurrentWeekStart,
  formatShortDate,
  getArxivAnnouncementDateString,
  getWeekEnd,
  getWeekStart,
  getWeekStarts,
  isExpectedQuietAnnouncementDay,
} from "@/lib/utils/dates";

describe("formatShortDate", () => {
  it("preserves calendar dates stored as YYYY-MM-DD strings", () => {
    expect(formatShortDate("2026-03-11")).toBe("Mar 11, 2026");
  });

  it("treats Friday and Saturday as expected quiet arXiv announcement days", () => {
    expect(isExpectedQuietAnnouncementDay("2026-03-13")).toBe(true);
    expect(isExpectedQuietAnnouncementDay("2026-03-14")).toBe(true);
    expect(isExpectedQuietAnnouncementDay("2026-03-11")).toBe(false);
  });

  it("tracks the current arXiv RSS day in New York time", () => {
    expect(getArxivAnnouncementDateString(new Date("2026-03-13T03:30:00.000Z"))).toBe(
      "2026-03-12",
    );
    expect(getArxivAnnouncementDateString(new Date("2026-03-13T04:30:00.000Z"))).toBe(
      "2026-03-13",
    );
  });

  it("derives Monday-Sunday week boundaries from an announcement day", () => {
    expect(getWeekStart("2026-03-11")).toBe("2026-03-09");
    expect(getWeekEnd("2026-03-11")).toBe("2026-03-15");
    expect(getWeekStart("2026-03-15")).toBe("2026-03-09");
  });

  it("formats weekly labels and ranges for the UI", () => {
    expect(formatWeekLabel("2026-03-09")).toBe("Week of Mar 9, 2026");
    expect(formatWeekRange("2026-03-09")).toBe("Mar 9-15, 2026");
  });

  it("tracks the current week using Pacific calendar boundaries", () => {
    expect(getCurrentWeekStart(new Date("2026-03-13T18:00:00.000Z"))).toBe("2026-03-09");
  });

  it("deduplicates announcement days into ordered week starts", () => {
    expect(
      getWeekStarts([
        "2026-03-13",
        "2026-03-12",
        "2026-03-10",
        "2026-03-06",
      ]),
    ).toEqual(["2026-03-09", "2026-03-02"]);
  });
});
