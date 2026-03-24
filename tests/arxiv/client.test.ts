import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArxivClient } from "@/lib/arxiv/client";

const { waitForTurnMock } = vi.hoisted(() => ({
  waitForTurnMock: vi.fn(async () => {}),
}));

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

const dailyFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Practical Agentic Search for Enterprise Workflows</title>
      <link>https://arxiv.org/abs/2603.01234v2</link>
      <description>arXiv:2603.01234v2 Announce Type: new Abstract: We study cost-aware agentic search for enterprise workflows.</description>
      <pubDate>Wed, 11 Mar 2026 00:00:00 GMT</pubDate>
      <category>cs.AI</category>
    </item>
  </channel>
</rss>`;

const cacheRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    cacheRoots.splice(0).map((cacheRoot) =>
      rm(cacheRoot, { recursive: true, force: true }),
    ),
  );
});

beforeEach(() => {
  waitForTurnMock.mockReset();
  waitForTurnMock.mockResolvedValue(undefined);
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
      requestGate: {
        waitForTurn: waitForTurnMock,
        applyPenalty: vi.fn(async () => {}),
      },
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
      requestGate: {
        waitForTurn: waitForTurnMock,
        applyPenalty: vi.fn(async () => {}),
      },
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
      requestGate: {
        waitForTurn: waitForTurnMock,
        applyPenalty: vi.fn(async () => {}),
      },
    });

    await client.fetchHistorical(["cs.AI", "cs.LG"], "2026-03-01", "2026-03-02");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("https://example.test/api/query?");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "search_query=%28cat%3Acs.AI+OR+cat%3Acs.LG%29+AND+submittedDate",
    );
  });

  it("honors Retry-After when arXiv rate limits the client", async () => {
    let nowMs = Date.parse("2026-03-23T00:00:00.000Z");
    const applyPenaltyMock = vi.fn(async () => {});
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("retry later", {
          status: 429,
          headers: {
            "retry-after": "5",
          },
        }),
      )
      .mockResolvedValueOnce(new Response(atomEntryXml, { status: 200 }));
    const sleepMock = vi.fn(async (ms: number) => {
      nowMs += ms;
    });

    const client = new ArxivClient({
      fetchFn: fetchMock,
      sleepFn: sleepMock,
      nowFn: () => nowMs,
      apiMinDelayMs: 0,
      rssMinDelayMs: 0,
      retryBaseDelayMs: 100,
      requestGate: {
        waitForTurn: waitForTurnMock,
        applyPenalty: applyPenaltyMock,
      },
    });

    await client.fetchByArxivId("2603.01234");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(applyPenaltyMock).toHaveBeenCalledWith("api", expect.any(Number));
    expect(sleepMock).toHaveBeenCalledWith(expect.any(Number));
    expect(sleepMock.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(5000);
  });

  it("bypasses the cached API response when requested for a single-paper refetch", async () => {
    const nowMs = 0;
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "paperbrief-arxiv-"));
    cacheRoots.push(cacheRoot);

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(atomEntryXml, { status: 200 }))
      .mockResolvedValueOnce(new Response(atomEntryXml, { status: 200 }));

    const client = new ArxivClient({
      cacheRoot,
      fetchFn: fetchMock,
      nowFn: () => nowMs,
      apiMinDelayMs: 0,
      rssMinDelayMs: 0,
      apiCacheTtlMinutes: 60,
      requestGate: {
        waitForTurn: waitForTurnMock,
        applyPenalty: vi.fn(async () => {}),
      },
    });

    await client.fetchByArxivId("2603.01234");
    await client.fetchByArxivId("2603.01234", { bypassCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waitForTurnMock).toHaveBeenCalledTimes(2);
  });

  it("waits on the shared request gate before issuing metadata fetches", async () => {
    let releaseGate: () => void = () => {};
    const requestGate = {
      waitForTurn: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseGate = resolve;
          }),
      ),
      applyPenalty: vi.fn(async () => {}),
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(atomEntryXml, { status: 200 }));

    const client = new ArxivClient({
      fetchFn: fetchMock,
      apiMinDelayMs: 0,
      rssMinDelayMs: 0,
      requestGate,
    });

    const pendingFetch = client.fetchByArxivId("2603.01234");
    await Promise.resolve();

    expect(requestGate.waitForTurn).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    releaseGate();
    await pendingFetch;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to RSS-only daily records when API hydration stays rate-limited", async () => {
    const applyPenaltyMock = vi.fn(async () => {});
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("rss.arxiv.org")) {
          return new Response(dailyFeedXml, { status: 200 });
        }

        return new Response("retry later", { status: 429 });
      });
    const sleepMock = vi.fn(async () => {});

    const client = new ArxivClient({
      fetchFn: fetchMock,
      sleepFn: sleepMock,
      apiMinDelayMs: 0,
      rssMinDelayMs: 0,
      retryBaseDelayMs: 1,
      requestGate: {
        waitForTurn: waitForTurnMock,
        applyPenalty: applyPenaltyMock,
      },
    });

    const papers = await client.fetchDaily(["cs.AI"], "2026-03-11");

    expect(papers).toHaveLength(1);
    expect(papers[0]?.sourceMetadata).toMatchObject({
      sourceType: "arxiv-rss-fallback",
      announceType: "new",
    });
    expect(papers[0]?.abstract).toContain("cost-aware agentic search");
    expect(applyPenaltyMock).toHaveBeenCalled();
  });
});
