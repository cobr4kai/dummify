const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export type BootstrapBackfillConfig = {
  from: string;
  to: string;
  recomputeBriefs: boolean;
  categories?: string[];
  taskKey: string;
};

export function readBootstrapBackfillConfig(
  env: Record<string, string | undefined> = process.env,
): BootstrapBackfillConfig | null {
  const from = normalizeString(env.PAPERBRIEF_BOOTSTRAP_BACKFILL_FROM);
  const to = normalizeString(env.PAPERBRIEF_BOOTSTRAP_BACKFILL_TO);

  if (!from && !to) {
    return null;
  }

  if (!from || !to) {
    throw new Error(
      "Both PAPERBRIEF_BOOTSTRAP_BACKFILL_FROM and PAPERBRIEF_BOOTSTRAP_BACKFILL_TO must be set together.",
    );
  }

  if (!datePattern.test(from) || !datePattern.test(to)) {
    throw new Error(
      "PAPERBRIEF_BOOTSTRAP_BACKFILL_FROM and PAPERBRIEF_BOOTSTRAP_BACKFILL_TO must use YYYY-MM-DD format.",
    );
  }

  const categories = normalizeCategories(env.PAPERBRIEF_BOOTSTRAP_BACKFILL_CATEGORIES);
  const recomputeBriefs = parseBoolean(
    env.PAPERBRIEF_BOOTSTRAP_BACKFILL_RECOMPUTE_BRIEFS,
    false,
  );
  const taskKey =
    normalizeString(env.PAPERBRIEF_BOOTSTRAP_BACKFILL_KEY) ??
    buildBootstrapBackfillTaskKey({
      from,
      to,
      recomputeBriefs,
      categories,
    });

  return {
    from,
    to,
    recomputeBriefs,
    categories,
    taskKey,
  };
}

export function buildBootstrapBackfillTaskKey(input: {
  from: string;
  to: string;
  recomputeBriefs: boolean;
  categories?: string[];
}) {
  const categoryKey =
    input.categories && input.categories.length > 0
      ? input.categories.join(",")
      : "enabled-categories";
  const briefKey = input.recomputeBriefs ? "briefs" : "metadata-only";

  return `historical-backfill:${input.from}:${input.to}:${briefKey}:${categoryKey}`;
}

function normalizeCategories(value: string | undefined) {
  const raw = normalizeString(value);
  if (!raw) {
    return undefined;
  }

  const categories = raw
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);

  return categories.length > 0 ? categories : undefined;
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
