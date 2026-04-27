import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCategoryConfigsMock,
  getAppSettingsMock,
  getCurrentTechnicalBriefStatusMock,
  headersMock,
  resumeIngestionRunMock,
  startIngestionJobMock,
  redirectMock,
  reorderPublishedPaperForWeekMock,
  requireAdminMock,
  revalidatePathMock,
  resetAppSettingsMock,
  setPublishedPaperStateMock,
  updateAppSettingsMock,
  updateCategoryConfigsMock,
} = vi.hoisted(() => ({
  getCategoryConfigsMock: vi.fn(),
  getAppSettingsMock: vi.fn(),
  getCurrentTechnicalBriefStatusMock: vi.fn(),
  headersMock: vi.fn(),
  resumeIngestionRunMock: vi.fn(),
  startIngestionJobMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  reorderPublishedPaperForWeekMock: vi.fn(),
  requireAdminMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  resetAppSettingsMock: vi.fn(),
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
  resumeIngestionRun: resumeIngestionRunMock,
  startIngestionJob: startIngestionJobMock,
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
  getCurrentTechnicalBriefStatus: getCurrentTechnicalBriefStatusMock,
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
  resumeIngestionRunAction,
  setActiveHomepageDayAction,
  togglePublishedPaperAction,
  updateSettingsAction,
} from "@/app/admin/actions";

describe("admin actions", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    resumeIngestionRunMock.mockReset();
    startIngestionJobMock.mockReset();
    updateAppSettingsMock.mockReset();
    resetAppSettingsMock.mockReset();
    getCategoryConfigsMock.mockReset();
    getAppSettingsMock.mockReset();
    updateCategoryConfigsMock.mockReset();
    setPublishedPaperStateMock.mockReset();
    reorderPublishedPaperForWeekMock.mockReset();
    getCurrentTechnicalBriefStatusMock.mockReset();
    revalidatePathMock.mockReset();
    redirectMock.mockClear();

    requireAdminMock.mockResolvedValue(undefined);
    headersMock.mockResolvedValue(new Headers());
    startIngestionJobMock.mockResolvedValue({
      status: "started",
      runId: "run-1",
    });
    resumeIngestionRunMock.mockResolvedValue({
      status: "started",
      runId: "run-2",
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
      "REDIRECT:/admin/ingest?week=2026-03-16&notice=daily-refresh-started",
    );
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/ingest");
    expect(startIngestionJobMock).toHaveBeenCalledWith({
      mode: "DAILY",
      triggerSource: "MANUAL",
      announcementDay: "2026-03-20",
      recomputeScores: true,
      recomputeBriefs: false,
    });
  });

  it("redirects to the running notice when another ingest is already active", async () => {
    const formData = new FormData();
    formData.set("announcementDay", "2026-03-20");
    startIngestionJobMock.mockResolvedValueOnce({
      status: "already-running",
      runId: "run-1",
    });

    await expect(runDailyRefreshAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/ingest?week=2026-03-16&notice=ingest-already-running",
    );
    expect(startIngestionJobMock).toHaveBeenCalledTimes(1);
  });

  it("redirects missing historical ranges back to ingest", async () => {
    const formData = new FormData();

    await expect(runHistoricalRefreshAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/ingest?notice=missing-range",
    );
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/ingest");
  });

  it("redirects historical refresh failures back to ingest with an error notice", async () => {
    const formData = new FormData();
    formData.set("from", "2026-03-01");
    formData.set("to", "2026-03-02");

    await expect(runHistoricalRefreshAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/ingest?week=2026-03-09&notice=historical-refresh-started",
    );
    expect(startIngestionJobMock).toHaveBeenCalledWith({
      mode: "HISTORICAL",
      triggerSource: "MANUAL",
      from: "2026-03-01",
      to: "2026-03-02",
      recomputeScores: true,
      recomputeBriefs: false,
    });
  });

  it("resumes failed ingest runs from the ingest page", async () => {
    const formData = new FormData();
    formData.set("runId", "failed-run-1");
    formData.set("selectedWeek", "2026-03-16");

    await expect(resumeIngestionRunAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/ingest?week=2026-03-16&notice=ingest-resume-started",
    );
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/ingest");
    expect(resumeIngestionRunMock).toHaveBeenCalledWith("failed-run-1");
  });

  it("redirects to a clear notice when a failed ingest run cannot resume", async () => {
    const formData = new FormData();
    formData.set("runId", "failed-run-1");
    resumeIngestionRunMock.mockResolvedValueOnce({
      status: "not-resumable",
      runId: "failed-run-1",
    });

    await expect(resumeIngestionRunAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/ingest?notice=ingest-resume-unavailable",
    );
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

  it("publishes a paper without starting brief generation from the curate action", async () => {
    const formData = new FormData();
    formData.set("announcementDay", "2026-03-20");
    formData.set("paperId", "paper-1");
    formData.set("published", "true");

    setPublishedPaperStateMock.mockResolvedValue(undefined);
    getCurrentTechnicalBriefStatusMock.mockResolvedValue(null);

    await expect(togglePublishedPaperAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/edition?week=2026-03-16&notice=paper-published&focusPaper=paper-1&brief=missing",
    );
    expect(requireAdminMock).toHaveBeenCalledWith("/admin/edition");
    expect(setPublishedPaperStateMock).toHaveBeenCalledWith({
      announcementDay: "2026-03-20",
      paperId: "paper-1",
      published: true,
    });
    expect(getCurrentTechnicalBriefStatusMock).toHaveBeenCalledWith("paper-1");
  });
});
