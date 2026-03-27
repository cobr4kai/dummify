import { describe, expect, it } from "vitest";
import {
  buildBootstrapOpenAlexTaskKey,
  readBootstrapOpenAlexPublishedConfig,
} from "@/lib/bootstrap/openalex";

describe("readBootstrapOpenAlexPublishedConfig", () => {
  it("returns null when the published OpenAlex bootstrap flag is absent", () => {
    expect(readBootstrapOpenAlexPublishedConfig({})).toBeNull();
  });

  it("builds a default task key from the configured filters", () => {
    expect(
      readBootstrapOpenAlexPublishedConfig({
        PAPERBRIEF_BOOTSTRAP_OPENALEX_PUBLISHED: "true",
        PAPERBRIEF_BOOTSTRAP_OPENALEX_FROM_DAY: "2026-03-11",
        PAPERBRIEF_BOOTSTRAP_OPENALEX_TO_DAY: "2026-03-18",
        PAPERBRIEF_BOOTSTRAP_OPENALEX_PAPER_IDS: "paper-1,paper-2",
        PAPERBRIEF_BOOTSTRAP_OPENALEX_FORCE: "false",
      }),
    ).toEqual({
      fromAnnouncementDay: "2026-03-11",
      toAnnouncementDay: "2026-03-18",
      paperIds: ["paper-1", "paper-2"],
      force: false,
      taskKey: buildBootstrapOpenAlexTaskKey({
        fromAnnouncementDay: "2026-03-11",
        toAnnouncementDay: "2026-03-18",
        paperIds: ["paper-1", "paper-2"],
        force: false,
      }),
    });
  });

  it("throws on invalid dates", () => {
    expect(() =>
      readBootstrapOpenAlexPublishedConfig({
        PAPERBRIEF_BOOTSTRAP_OPENALEX_PUBLISHED: "true",
        PAPERBRIEF_BOOTSTRAP_OPENALEX_FROM_DAY: "03/11/2026",
      }),
    ).toThrow("PAPERBRIEF_BOOTSTRAP_OPENALEX_FROM_DAY must use YYYY-MM-DD format.");
  });
});
