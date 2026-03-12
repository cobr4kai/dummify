import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

async function main() {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("db:bootstrap only supports local SQLite file URLs.");
  }

  const databasePath = resolveSqlitePath(databaseUrl);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const migrationFolders = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const client = createClient({
    url: `file:${databasePath}`,
  });

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS paperbrief_bootstrap_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const folder of migrationFolders) {
      const alreadyApplied = await client.execute({
        sql: "SELECT name FROM paperbrief_bootstrap_migrations WHERE name = ?",
        args: [folder],
      });

      if (alreadyApplied.rows.length > 0) {
        continue;
      }

      // If the initial schema was already created outside this helper, record it
      // so repeated bootstrap runs stay safe.
      if (
        folder === migrationFolders[0] &&
        (await tableExists(client, "Paper")) &&
        (await tableExists(client, "IngestionRun"))
      ) {
        await client.execute({
          sql: "INSERT INTO paperbrief_bootstrap_migrations (name) VALUES (?)",
          args: [folder],
        });
        continue;
      }

      const sql = fs.readFileSync(
        path.join(migrationsDir, folder, "migration.sql"),
        "utf8",
      );
      const statements = sql
        .split(/;\s*\r?\n/g)
        .map((statement) => statement.trim())
        .filter(Boolean);

      if (statements.length > 0) {
        await client.batch(
          statements.map((statement) => ({
            sql: statement,
          })),
          "write",
        );
      }

      await client.execute({
        sql: "INSERT INTO paperbrief_bootstrap_migrations (name) VALUES (?)",
        args: [folder],
      });
    }

    console.log(`Bootstrapped SQLite database at ${databasePath}`);
  } finally {
    await client.close();
  }
}

function resolveSqlitePath(url) {
  const raw = url.slice("file:".length);
  if (!raw) {
    throw new Error("DATABASE_URL must point to a local SQLite file.");
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  return path.resolve(process.cwd(), raw);
}

async function tableExists(client, tableName) {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [tableName],
  });

  return result.rows.length > 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
