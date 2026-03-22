import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS } from "@/config/defaults";
import {
  appSettingsSchema,
  ARXIV_METADATA_MIN_DELAY_FLOOR_MS,
} from "@/lib/settings/service";

describe("appSettingsSchema", () => {
  it("rejects RSS pacing below the arXiv compliance floor", () => {
    expect(() =>
      appSettingsSchema.parse({
        ...DEFAULT_APP_SETTINGS,
        rssMinDelayMs: ARXIV_METADATA_MIN_DELAY_FLOOR_MS - 1,
      }),
    ).toThrow();
  });

  it("rejects API pacing below the arXiv compliance floor", () => {
    expect(() =>
      appSettingsSchema.parse({
        ...DEFAULT_APP_SETTINGS,
        apiMinDelayMs: ARXIV_METADATA_MIN_DELAY_FLOOR_MS - 1,
      }),
    ).toThrow();
  });
});
