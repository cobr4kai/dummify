import { createClient } from "@libsql/client";
import { readBootstrapOpenAlexPublishedConfig } from "../src/lib/bootstrap/openalex";
import { backfillOpenAlexForPublishedPapers } from "../src/lib/ingestion/service";

async function main() {
  const config = readBootstrapOpenAlexPublishedConfig();

  if (!config) {
    console.log("Skipping one-time OpenAlex published backfill because it is not configured.");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for OpenAlex bootstrap backfill.");
  }

  const client = createClient({ url: databaseUrl });

  try {
    await ensureTaskTable(client);

    const existing = await client.execute({
      sql: "SELECT status FROM paperbrief_bootstrap_tasks WHERE task_key = ?",
      args: [config.taskKey],
    });
    const status = existing.rows[0]?.status;

    if (status === "completed") {
      console.log(
        `Skipping one-time OpenAlex published backfill; task ${config.taskKey} already completed.`,
      );
      return;
    }

    await client.execute({
      sql: `
        INSERT INTO paperbrief_bootstrap_tasks (task_key, status, details)
        VALUES (?, 'running', ?)
        ON CONFLICT(task_key) DO UPDATE SET
          status = 'running',
          details = excluded.details,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        config.taskKey,
        JSON.stringify({
          fromAnnouncementDay: config.fromAnnouncementDay ?? null,
          toAnnouncementDay: config.toAnnouncementDay ?? null,
          paperIds: config.paperIds ?? null,
          force: config.force,
        }),
      ],
    });

    console.log("Running one-time OpenAlex backfill for published papers.");

    const result = await backfillOpenAlexForPublishedPapers({
      paperIds: config.paperIds,
      fromAnnouncementDay: config.fromAnnouncementDay,
      toAnnouncementDay: config.toAnnouncementDay,
      force: config.force,
    });

    await client.execute({
      sql: `
        UPDATE paperbrief_bootstrap_tasks
        SET status = 'completed',
            details = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE task_key = ?
      `,
      args: [JSON.stringify(result), config.taskKey],
    });

    console.log(
      `Completed one-time OpenAlex published backfill for ${result.updatedCount} of ${result.paperCount} papers.`,
    );
  } catch (error) {
    await client.execute({
      sql: `
        INSERT INTO paperbrief_bootstrap_tasks (task_key, status, details)
        VALUES (?, 'failed', ?)
        ON CONFLICT(task_key) DO UPDATE SET
          status = 'failed',
          details = excluded.details,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        config.taskKey,
        JSON.stringify({
          message:
            error instanceof Error
              ? error.message
              : "Unknown OpenAlex bootstrap backfill error.",
        }),
      ],
    });

    throw error;
  } finally {
    await client.close();
  }
}

async function ensureTaskTable(client: ReturnType<typeof createClient>) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS paperbrief_bootstrap_tasks (
      task_key TEXT NOT NULL PRIMARY KEY,
      status TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
