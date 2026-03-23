import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAdminSnapshotMock,
  requireAdminMock,
} = vi.hoisted(() => ({
  getAdminSnapshotMock: vi.fn(),
  requireAdminMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/search/service", () => ({
  getAdminSnapshot: getAdminSnapshotMock,
}));

import AdminPage from "@/app/admin/page";
import AdminEditionPage from "@/app/admin/edition/page";
import AdminIngestPage from "@/app/admin/ingest/page";
import AdminSettingsPage from "@/app/admin/settings/page";

const baseSnapshot = {
  settings: {
    genAiFeaturedCount: 10,
    genAiShortlistSize: 25,
    highBusinessRelevanceThreshold: 70,
    pdfCacheDir: ".paperbrief-cache",
    primaryCronSchedule: "15 17 * * 0-4",
    reconcileCronSchedule: "45 20 * * 0-4",
    genAiUsePremiumSynthesis: true,
    reconcileEnabled: true,
    rssMinDelayMs: 1000,
    apiMinDelayMs: 3100,
    retryBaseDelayMs: 800,
    feedCacheTtlMinutes: 60,
    apiCacheTtlMinutes: 180,
    genAiRankingWeights: {
      frontierRelevance: 1,
      capabilityImpact: 1,
      realWorldImpact: 1,
      evidenceStrength: 1,
      audiencePull: 1,
    },
  },
  categories: [
    { key: "cs.AI", label: "AI", enabled: true, displayOrder: 1 },
  ],
  runs: [
    {
      id: "run-1",
      status: "COMPLETED",
      mode: "DAILY",
      triggerSource: "MANUAL",
      startedAt: new Date("2026-03-20T17:00:00.000Z"),
      fetchedCount: 5,
      upsertedCount: 5,
      scoreCount: 5,
      summaryCount: 2,
      logLines: [],
    },
  ],
  latestDay: "2026-03-20",
  latestCompletedWeekStart: "2026-03-16",
  weeks: ["2026-03-16", "2026-03-09"],
  selectedWeek: "2026-03-16",
  selectedWeekLabel: "Week of Mar 16, 2026",
  activeHomepageWeekStart: "2026-03-16",
  activeHomepageWeekEnd: "2026-03-22",
  activeHomepageWeekLabel: "Week of Mar 16, 2026",
  publishedPaperIds: ["paper-1"],
  publishedCount: 1,
  editionPapers: [],
  activeHomepagePaperIds: ["paper-1"],
  activeHomepageBriefReadyCount: 1,
  activeHomepageMissingBriefCount: 0,
  activeHomepageIsCurated: true,
  technicalBriefCount: 12,
  pdfCacheCount: 15,
};

describe("admin route pages", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    getAdminSnapshotMock.mockReset();
    requireAdminMock.mockResolvedValue(undefined);
    getAdminSnapshotMock.mockResolvedValue(baseSnapshot);
  });

  it("requires admin access for overview", async () => {
    await AdminPage();

    expect(requireAdminMock).toHaveBeenCalledWith("/admin");
    expect(getAdminSnapshotMock).toHaveBeenCalledWith();
  });

  it("requires admin access for edition", async () => {
    await AdminEditionPage({
      searchParams: Promise.resolve({ week: "2026-03-16" }),
    });

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/edition");
    expect(getAdminSnapshotMock).toHaveBeenCalledWith({ weekStart: "2026-03-16" });
  });

  it("requires admin access for ingest", async () => {
    await AdminIngestPage({
      searchParams: Promise.resolve({}),
    });

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/ingest");
    expect(getAdminSnapshotMock).toHaveBeenCalledWith();
  });

  it("requires admin access for settings", async () => {
    await AdminSettingsPage({
      searchParams: Promise.resolve({}),
    });

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/settings");
    expect(getAdminSnapshotMock).toHaveBeenCalledWith();
  });
});
