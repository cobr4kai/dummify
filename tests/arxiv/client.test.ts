import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArxivClient } from "@/lib/arxiv/client";

const atomEntryXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2603.01234v2</id>
    <updated>2026-03-11T08:00:00Z</updated>
    <published>2026-03-10T21:00:00Z</published>
    <title>Practical Agentic Search for Enterprise Workflows</title>
    <summary>We report a 22% latency reduction for enterprise retrieval workflows.</summary>
    <author>
      <name>Alice Example</name>
    </author>
    <link href="https://arxiv.org/abs/2603.01234v2" rel="alternate" type="text/html" />
    <link href="https://arxiv.org/pdf/2603.01234v2" rel="related" title="pdf" type="application/pdf" />
    <category term="cs.AI" />
    <arxiv:comment>Benchmarked on enterprise support workflows.</arxiv:comment>
    <arxiv:primary_category term="cs.AI" />
  </entry>
</feed>`;

const emptyAtomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"></feed>`;

const cacheRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cacheRoots.splice(0).map((cacheRoot) =>
      rm(cacheRoot, { recursive: true, force: true }),
    ),
  );
});

describe("ArxivClient", () => {
  it("retries retryable API responses and reuses cached responses within TTL", async () => {
    let nowMs = 0;
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "paperbrief-arxiv-"));
    cacheRoots.push(cacheRoot);

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("retry later", { status: 429 }))
      .mockResolvedValueOnce(new Response(atomEntryXml, { status: 200 }));
    const sleepMock = vi.fn(async (ms: number) => {
      nowMs += ms;
    });

    const client = new ArxivClient({
      cacheRoot,
      fetchFn: fetchMock,
      sleepFn: sleepMock,
      nowFn: () => nowMs,
      apiMinDelayMs: 0,
      rssMinDelayMs: 0,
      retryBaseDelayMs: 100,
      apiCacheTtlMinutes: 60,
    });

    const firstResult = await client.fetchByArxivId("2603.01234");
    const cachedResult = await client.fetchByArxivId("2603.01234");

    expect(firstResult?.arxivId).toBe("2603.01234");
    expect(firstResult?.comment).toBe("Benchmarked on enterprise support workflows.");
    expect(cachedResult?.versionedId).toBe("2603.01234v2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not retry non-retryable API errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("missing", { status: 404 }));
    const sleepMock = vi.fn(async () => {});

    const client = new ArxivClient({
      fetchFn: fetchMock,
      sleepFn: sleepMock,
      apiMinDelayMs: 0,
      rssMinDelayMs: 0,
    });

    await expect(client.fetchByArxivId("2603.99999")).rejects.toThrow(
      "arXiv returned 404.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it("uses the configured API base URL for historical metadata queries", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(emptyAtomXml, { status: 200 }));

    const client = new ArxivClient({
      apiBaseUrl: "https://example.test/api/query",
      fetchFn: fetchMock,
      apiMinDelayMs: 0,
      rssMinDelayMs: 0,
    });

    await client.fetchHistorical(["cs.AI", "cs.LG"], "2026-03-01", "2026-03-02");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("https://example.test/api/query?");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "search_query=%28cat%3Acs.AI+OR+cat%3Acs.LG%29+AND+submittedDate",
    );
  });
});
