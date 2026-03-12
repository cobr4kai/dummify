import { createHash } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";

type CacheLane = "api" | "rss";

type CachedPayload = {
  body: string;
  savedAt: number;
  url: string;
};

type CacheOptions = {
  cacheRoot?: string;
  lane: CacheLane;
  nowMs: number;
  ttlMinutes: number;
  url: string;
};

export async function readCachedHttpResponse(options: CacheOptions) {
  if (!options.cacheRoot || options.ttlMinutes <= 0) {
    return null;
  }

  const cachePath = buildCachePath(options.cacheRoot, options.lane, options.url);

  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const cached = JSON.parse(raw) as CachedPayload;

    if (options.nowMs - cached.savedAt > options.ttlMinutes * 60 * 1000) {
      return null;
    }

    return cached.body;
  } catch {
    return null;
  }
}

export async function writeCachedHttpResponse(options: CacheOptions, body: string) {
  if (!options.cacheRoot || options.ttlMinutes <= 0) {
    return;
  }

  const cachePath = buildCachePath(options.cacheRoot, options.lane, options.url);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(
    cachePath,
    JSON.stringify(
      {
        body,
        savedAt: options.nowMs,
        url: options.url,
      } satisfies CachedPayload,
      null,
      2,
    ),
    "utf8",
  );
}

function buildCachePath(cacheRoot: string, lane: CacheLane, url: string) {
  const hash = createHash("sha256").update(url).digest("hex");
  return path.resolve(cacheRoot, "http", "arxiv", lane, `${hash}.json`);
}
