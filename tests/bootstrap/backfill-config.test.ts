import { describe, expect, it } from "vitest";
import {
  buildBootstrapBackfillTaskKey,
  readBootstrapBackfillConfig,
} from "@/lib/bootstrap/backfill";

describe("readBootstrapBackfillConfig", () => {
  it("returns null when no bootstrap backfill range is configured", () => {
    expect(readBootstrapBackfillConfig({})).toBeNull();
  });

  it("returns null when only the production disk path is present", () => {
    expect(
      readBootstrapBackfillConfig({
        DATABASE_URL: "file:/var/data/paperbrief.db",
      }),
    ).toBeNull();
  });
  it("builds a default task key from the configured range and options", () => {
    expect(
      readBootstrapBackfillConfig({
        PAPERBRIEF_BOOTSTRAP_BACKFILL_FROM: "2026-03-11",
        PAPERBRIEF_BOOTSTRAP_BACKFILL_TO: "2026-03-11",
        PAPERBRIEF_BOOTSTRAP_BACKFILL_RECOMPUTE_BRIEFS: "true",
        PAPERBRIEF_BOOTSTRAP_BACKFILL_CATEGORIES: "cs.AI, cs.LG",
      }),
    ).toEqual({
      from: "2026-03-11",
      to: "2026-03-11",
      recomputeBriefs: true,
      categories: ["cs.AI", "cs.LG"],
      taskKey: buildBootstrapBackfillTaskKey({
        from: "2026-03-11",
        to: "2026-03-11",
        recomputeBriefs: true,
        categories: ["cs.AI", "cs.LG"],
      }),
    });
  });

  it("throws when only one side of the range is configured", () => {
    expect(() =>
      readBootstrapBackfillConfig({
        PAPERBRIEF_BOOTSTRAP_BACKFILL_FROM: "2026-03-11",
      }),
    ).toThrow("must be set together");
  });
});
