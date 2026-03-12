import { createClient } from "@libsql/client";
import { TriggerSource } from "@prisma/client";
import { readBootstrapBackfillConfig } from "../src/lib/bootstrap/backfill";
import { runIngestionJob } from "../src/lib/ingestion/service";

async function main() {
  const config = readBootstrapBackfillConfig();

  if (!config) {
    console.log(
      "Skipping one-time bootstrap backfill because no PAPERBRIEF_BOOTSTRAP_BACKFILL_* range is configured.",
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for bootstrap backfill.");
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
      console.log(`Skipping one-time bootstrap backfill; task ${config.taskKey} already completed.`);
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
          from: config.from,
          to: config.to,
          recomputeBriefs: config.recomputeBriefs,
          categories: config.categories ?? null,
        }),
      ],
    });

    console.log(
      `Running one-time bootstrap backfill for ${config.from} through ${config.to}.`,
    );

    const result = await runIngestionJob({
      mode: "HISTORICAL",
      triggerSource: TriggerSource.MANUAL,
      from: config.from,
      to: config.to,
      categories: config.categories,
      recomputeScores: true,
      recomputeBriefs: config.recomputeBriefs,
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
      `Completed one-time bootstrap backfill for ${config.from} through ${config.to}.`,
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
          message: error instanceof Error ? error.message : "Unknown bootstrap backfill error.",
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
