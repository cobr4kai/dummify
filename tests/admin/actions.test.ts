import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensurePaperTechnicalBriefMock,
  getCategoryConfigsMock,
  getAppSettingsMock,
  getCurrentTechnicalBriefMock,
  headersMock,
  redirectMock,
  reorderPublishedPaperForWeekMock,
  requireAdminMock,
  revalidatePathMock,
  resetAppSettingsMock,
  runIngestionJobMock,
  setPublishedPaperStateMock,
  updateAppSettingsMock,
  updateCategoryConfigsMock,
} = vi.hoisted(() => ({
  ensurePaperTechnicalBriefMock: vi.fn(),
  getCategoryConfigsMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
  getCurrentTechnicalBriefMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  reorderPublishedPaperForWeekMock: vi.fn(),
  requireAdminMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  resetAppSettingsMock: vi.fn(),
  runIngestionJobMock: vi.fn(),
  setPublishedPaperStateMock: vi.fn(),
  updateAppSettingsMock: vi.fn(),
  updateCategoryConfigsMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  clearAdminSession: vi.fn(),
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/ingestion/service", () => ({
  runIngestionJob: runIngestionJobMock,
}));

vi.mock("@/lib/publishing/service", () => ({
  reorderPublishedPaperForWeek: reorderPublishedPaperForWeekMock,
  setPublishedPaperState: setPublishedPaperStateMock,
}));

vi.mock("@/lib/settings/service", () => ({
  getCategoryConfigs: getCategoryConfigsMock,
  getAppSettings: getAppSettingsMock,
  resetAppSettings: resetAppSettingsMock,
  updateAppSettings: updateAppSettingsMock,
  updateCategoryConfigs: updateCategoryConfigsMock,
}));

vi.mock("@/lib/technical/service", () => ({
  ensurePaperTechnicalBrief: ensurePaperTechnicalBriefMock,
  getCurrentTechnicalBrief: getCurrentTechnicalBriefMock,
}));

vi.mock("@/lib/utils/dates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/dates")>("@/lib/utils/dates");

  return {
    ...actual,
    getArxivAnnouncementDateString: vi.fn(() => "2026-03-20"),
    getWeekStart: vi.fn((value: string) => (value >= "2026-03-16" ? "2026-03-16" : "2026-03-09")),
  };
});

import {
  runDailyRefreshAction,
  runHistoricalRefreshAction,
  setActiveHomepageDayAction,
  updateSettingsAction,
} from "@/app/admin/actions";

describe("admin actions", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    runIngestionJobMock.mockReset();
    updateAppSettingsMock.mockReset();
    resetAppSettingsMock.mockReset();
    getCategoryConfigsMock.mockReset();
    getAppSettingsMock.mockReset();
    updateCategoryConfigsMock.mockReset();
    setPublishedPaperStateMock.mockReset();
    reorderPublishedPaperForWeekMock.mockReset();
    ensurePaperTechnicalBriefMock.mockReset();
    getCurrentTechnicalBriefMock.mockReset();
    revalidatePathMock.mockReset();
    redirectMock.mockClear();

    requireAdminMock.mockResolvedValue(undefined);
    headersMock.mockResolvedValue(new Headers());
    runIngestionJobMock.mockResolvedValue({
      fetchedCount: 4,
      upsertedCount: 4,
      summaryCount: 2,
    });
    updateAppSettingsMock.mockResolvedValue(undefined);
    getAppSettingsMock.mockResolvedValue({
      genAiScoringPreset: "non_research",
    });
  });

  it("redirects daily refresh back to ingest", async () => {
    const formData = new FormData();
    formData.set("announcementDay", "2026-03-20");

    await expect(runDailyRefreshAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/ingest?week=2026-03-16&notice=daily-refresh&fetched=4&upserted=4&generated=2",
    );
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/ingest");
  });

  it("redirects missing historical ranges back to ingest", async () => {
    const formData = new FormData();

    await expect(runHistoricalRefreshAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/ingest?notice=missing-range",
    );
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/ingest");
  });

  it("redirects settings saves back to settings", async () => {
    const formData = new FormData();
    formData.set("audienceInterest", "1");
    formData.set("frontierRelevance", "1");
    formData.set("practicalRelevance", "1");
    formData.set("evidenceCredibility", "1");
    formData.set("tldrAccessibility", "1");

    await expect(updateSettingsAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/settings?notice=settings-saved",
    );
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/settings");
  });

  it("redirects homepage changes back to edition", async () => {
    const formData = new FormData();
    formData.set("activeHomepageWeekStart", "2026-03-16");

    await expect(setActiveHomepageDayAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/edition?week=2026-03-16&notice=homepage-day-set",
    );
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/edition");
  });
});
