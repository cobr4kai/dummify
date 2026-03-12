import cron from "node-cron";
import { TriggerSource } from "@prisma/client";
import { env } from "@/lib/env";
import { runIngestionJob } from "@/lib/ingestion/service";
import { getAppSettings } from "@/lib/settings/service";
import { getPacificDateString } from "@/lib/utils/dates";

declare global {
  var paperBriefCronStarted: boolean | undefined;
}

export async function startLocalScheduler() {
  if (!env.ENABLE_LOCAL_CRON || global.paperBriefCronStarted) {
    return;
  }

  const settings = await getAppSettings();
  global.paperBriefCronStarted = true;

  cron.schedule(settings.primaryCronSchedule, async () => {
    try {
      await runIngestionJob({
        mode: "DAILY",
        jobMode: "PRIMARY",
        triggerSource: TriggerSource.SCHEDULED,
        announcementDay: getPacificDateString(),
      });
    } catch (error) {
      console.error("PaperBrief primary cron run failed.", error);
    }
  }, {
    timezone: "America/Los_Angeles",
  });

  if (!settings.reconcileEnabled) {
    return;
  }

  cron.schedule(settings.reconcileCronSchedule, async () => {
    try {
      await runIngestionJob({
        mode: "DAILY",
        jobMode: "RECONCILE",
        triggerSource: TriggerSource.SCHEDULED,
        announcementDay: getPacificDateString(),
      });
    } catch (error) {
      console.error("PaperBrief reconcile cron run failed.", error);
    }
  }, {
    timezone: "America/Los_Angeles",
  });
}
