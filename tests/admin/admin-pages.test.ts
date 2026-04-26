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

vi.mock("@/lib/feedback/service", () => ({
  getAppFeedbackSnapshot: vi.fn().mockResolvedValue({
    totalCount: 0,
    usefulCount: 0,
    notUsefulCount: 0,
    withEmailCount: 0,
    feedback: [],
  }),
}));

import AdminPage from "@/app/admin/page";
import AdminEditionPage from "@/app/admin/edition/page";
import AdminFeedbackPage from "@/app/admin/feedback/page";
import AdminIngestPage from "@/app/admin/ingest/page";
import AdminSettingsPage from "@/app/admin/settings/page";

const baseSnapshot = {
  settings: {
    genAiFeaturedCount: 10,
    genAiShortlistSize: 25,
    highBusinessRelevanceThreshold: 70,
    genAiScoringPreset: "non_research",
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
      audienceInterest: 1,
      frontierRelevance: 1,
      practicalRelevance: 1,
      evidenceCredibility: 1,
      tldrAccessibility: 1,
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
  editionPaperLimit: 350,
  editionPaperOffset: 0,
  editionPaperTotal: 0,
  editionQuery: "",
  activeHomepagePaperIds: ["paper-1"],
  activeHomepageBriefReadyCount: 1,
  activeHomepageMissingBriefCount: 0,
  activeHomepageIsCurated: true,
  technicalBriefCount: 12,
  pdfCacheCount: 15,
  currentScoreCount: 18,
  legacyScoreCount: 6,
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
    expect(getAdminSnapshotMock).toHaveBeenCalledWith({
      editionOffset: 0,
      editionQuery: "",
      includeEditionData: true,
      weekStart: "2026-03-16",
    });
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

  it("requires admin access for feedback", async () => {
    await AdminFeedbackPage();

    expect(requireAdminMock).toHaveBeenCalledWith("/admin/feedback");
  });
});
