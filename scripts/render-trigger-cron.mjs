import process from "node:process";

const mode = process.argv[2];

if (mode !== "primary" && mode !== "reconcile") {
  console.error('Usage: node scripts/render-trigger-cron.mjs <primary|reconcile>');
  process.exit(1);
}

const cronSecret = readRequiredEnv("CRON_SECRET");
const baseUrl = resolveBaseUrl();

async function main() {
  const url = new URL("/api/cron/daily-refresh", baseUrl);
  url.searchParams.set("job", mode);

  const announcementDay = process.env.CRON_ANNOUNCEMENT_DAY?.trim();
  if (announcementDay) {
    url.searchParams.set("day", announcementDay);
  }

  console.log(`Triggering ${mode} cron run at ${url.toString()}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const body = await response.text();
  console.log(body);

  if (!response.ok) {
    throw new Error(`Cron trigger failed with status ${response.status}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function resolveBaseUrl() {
  const explicitBaseUrl = process.env.PAPERBRIEF_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const hostPort = process.env.PAPERBRIEF_HOSTPORT?.trim();
  if (hostPort) {
    return `http://${hostPort}`;
  }

  return readRequiredEnv("RENDER_EXTERNAL_URL");
}

function readRequiredEnv(key) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} must be configured.`);
  }

  return value;
}
