import { Badge } from "@/components/ui/badge";
import { AdminNoticeBanner, type AdminNotice } from "@/components/admin-notice-banner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminSettingsPanels } from "@/components/admin-settings-panels";
import { PageShell } from "@/components/page-shell";
import {
  resetSettingsAction,
  updateCategoriesAction,
  updateSettingsAction,
} from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { getAdminSnapshot } from "@/lib/search/service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  notice?: string;
  sort?: string;
  dir?: string;
}>;

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin("/admin/settings");
  const params = await searchParams;
  const snapshot = await getAdminSnapshot();
  const sortKey = typeof params.sort === "string" && params.sort ? params.sort : null;
  const sortDirection = typeof params.dir === "string" && params.dir ? params.dir : null;
  const notice = getSettingsNotice(typeof params.notice === "string" ? params.notice : null);

  return (
    <PageShell
      currentPath="/admin/settings"
      tone="utility"
      headerContent={(
        <AdminPageHeader
          badges={(
            <>
              <Badge variant={env.OPENAI_API_KEY ? "success" : "highlight"}>
                OpenAI {env.OPENAI_API_KEY ? "configured" : "not configured"}
              </Badge>
              <Badge variant={env.OPENALEX_API_KEY ? "success" : "muted"}>
                OpenAlex {env.OPENALEX_API_KEY ? "configured" : "optional / off"}
              </Badge>
              <Badge variant={env.OPENAI_ENABLE_PREMIUM_SYNTHESIS ? "success" : "muted"}>
                Premium synthesis {env.OPENAI_ENABLE_PREMIUM_SYNTHESIS ? "enabled" : "disabled"}
              </Badge>
            </>
          )}
          currentPath="/admin/settings"
          description="Adjust editorial scoring, model policy, cache behavior, schedules, and source categories without mixing that work into ingest or curation."
          title="Settings"
        />
      )}
    >
      <AdminNoticeBanner contextLabel="Settings update" notice={notice} />

      <section>
        <AdminSettingsPanels
          categories={snapshot.categories}
          resetSettingsAction={resetSettingsAction}
          settings={snapshot.settings}
          sortDirection={sortDirection}
          sortKey={sortKey}
          updateCategoriesAction={updateCategoriesAction}
          updateSettingsAction={updateSettingsAction}
        />
      </section>
    </PageShell>
  );
}

function getSettingsNotice(notice: string | null): AdminNotice {
  switch (notice) {
    case "settings-saved":
      return {
        title: "Settings saved",
        description:
          "Your editorial settings were saved. Fresh ingestion runs will now use the updated ranking and runtime policy.",
        variant: "success",
      };
    case "settings-reset":
      return {
        title: "Defaults restored",
        description:
          "The admin settings have been reset to the repo defaults for counts, pacing, ranking, and schedule fields.",
        variant: "highlight",
      };
    case "categories-saved":
      return {
        title: "Categories updated",
        description:
          "Source category toggles were saved. The next ingestion run will use the new enabled category set.",
        variant: "success",
      };
    default:
      return null;
  }
}
