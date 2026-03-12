import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const port = process.env.PORT ?? "10000";
const require = createRequire(import.meta.url);

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? "";

  if (databaseUrl.startsWith("file:")) {
    console.log("Bootstrapping local SQLite database on persistent disk.");
    await run(process.execPath, [path.resolve("scripts/bootstrap-db.mjs")]);
  } else {
    console.log("Skipping bootstrap-db because DATABASE_URL is not a local SQLite file URL.");
  }

  console.log("Checking one-time bootstrap backfill tasks before starting the web server.");
  await run(process.execPath, [
    require.resolve("tsx/dist/cli.mjs"),
    path.resolve("scripts/bootstrap-backfill.ts"),
  ]);

  await run(
    process.execPath,
    [
      path.resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      port,
    ],
    { forwardSignals: true },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    if (options.forwardSignals) {
      const forward = (signal) => {
        if (!child.killed) {
          child.kill(signal);
        }
      };

      process.on("SIGINT", forward);
      process.on("SIGTERM", forward);
    }

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command ${command} exited due to signal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Command ${command} exited with status ${code}.`));
        return;
      }

      resolve(undefined);
    });

    child.on("error", reject);
  });
}
