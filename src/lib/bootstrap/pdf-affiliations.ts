const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type BootstrapPdfAffiliationsConfig = {
  fromAnnouncementDay?: string;
  toAnnouncementDay?: string;
  paperIds?: string[];
  force: boolean;
  taskKey: string;
};

export function readBootstrapPdfAffiliationsConfig(
  env: Record<string, string | undefined> = process.env,
): BootstrapPdfAffiliationsConfig | null {
  const enabled = parseBoolean(env.PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_PUBLISHED, false);
  if (!enabled) {
    return null;
  }

  const fromAnnouncementDay = normalizeDate(
    env.PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_FROM_DAY,
    "PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_FROM_DAY",
  );
  const toAnnouncementDay = normalizeDate(
    env.PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_TO_DAY,
    "PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_TO_DAY",
  );
  const paperIds = normalizeList(env.PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_PAPER_IDS);
  const force = parseBoolean(env.PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_FORCE, true);
  const taskKey =
    normalizeString(env.PAPERBRIEF_BOOTSTRAP_PDF_AFFILIATIONS_KEY) ??
    buildBootstrapPdfAffiliationsTaskKey({
      fromAnnouncementDay,
      toAnnouncementDay,
      paperIds,
      force,
    });

  return {
    fromAnnouncementDay,
    toAnnouncementDay,
    paperIds,
    force,
    taskKey,
  };
}

export function buildBootstrapPdfAffiliationsTaskKey(input: {
  fromAnnouncementDay?: string;
  toAnnouncementDay?: string;
  paperIds?: string[];
  force: boolean;
}) {
  const dayRange = [input.fromAnnouncementDay ?? "start", input.toAnnouncementDay ?? "latest"].join(
    ":",
  );
  const paperKey =
    input.paperIds && input.paperIds.length > 0 ? input.paperIds.join(",") : "all-published";
  const forceKey = input.force ? "force" : "reuse-current";

  return `pdf-affiliations-backfill:${dayRange}:${paperKey}:${forceKey}`;
}

function normalizeDate(value: string | undefined, envKey: string) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  if (!datePattern.test(normalized)) {
    throw new Error(`${envKey} must use YYYY-MM-DD format.`);
  }

  return normalized;
}

function normalizeList(value: string | undefined) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const items = normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function normalizeString(value: string | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return defaultValue;
}
