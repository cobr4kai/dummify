import { describe, expect, it } from "vitest";
import {
  buildBootstrapPdfAffiliationsTaskKey,
  readBootstrapPdfAffiliationsConfig,
} from "@/lib/bootstrap/pdf-affiliations";

describe("readBootstrapPdfAffiliationsConfig", () => {
  it("returns null when the published PDF affiliation bootstrap flag is absent", () => {
    expect(readBootstrapPdfAffiliationsConfig({})).toBeNull();
  });

  it("builds a default task key from the configured filters", () => {
    expect(
      readBootstrapPdfAffiliationsConfig({
        PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_PUBLISHED: "true",
        PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_FROM_DAY: "2026-03-16",
        PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_TO_DAY: "2026-03-23",
        PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_PAPER_IDS: "paper-1,paper-2",
        PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_FORCE: "false",
      }),
    ).toEqual({
      fromAnnouncementDay: "2026-03-16",
      toAnnouncementDay: "2026-03-23",
      paperIds: ["paper-1", "paper-2"],
      force: false,
      taskKey: buildBootstrapPdfAffiliationsTaskKey({
        fromAnnouncementDay: "2026-03-16",
        toAnnouncementDay: "2026-03-23",
        paperIds: ["paper-1", "paper-2"],
        force: false,
      }),
    });
  });
});
