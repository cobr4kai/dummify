import { describe, expect, it } from "vitest";
import {
  extractAbstractFromDailyDescription,
  parseAtomFeed,
  parseDailyFeed,
} from "@/lib/arxiv/parsers";
import { buildHistoricalQuery } from "@/lib/arxiv/query-builder";

const dailyFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Practical Agentic Search for Enterprise Workflows</title>
      <link>https://arxiv.org/abs/2603.01234v2</link>
      <description>arXiv:2603.01234v2 Announce Type: new Abstract:   We study cost-aware agentic search for enterprise workflows.   </description>
      <pubDate>Wed, 11 Mar 2026 00:00:00 GMT</pubDate>
      <category>cs.AI</category>
      <category>cs.IR</category>
    </item>
  </channel>
</rss>`;

const atomFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2603.01234v2</id>
    <updated>2026-03-11T08:00:00Z</updated>
    <published>2026-03-10T21:00:00Z</published>
    <title>
      Practical Agentic Search
      for Enterprise Workflows
    </title>
    <summary>
      We introduce a retrieval pipeline for enterprise knowledge work.
      It improves latency and budget discipline.
    </summary>
    <author>
      <name>Alice Example</name>
    </author>
    <author>
      <name>Bob Example</name>
    </author>
    <link href="https://arxiv.org/abs/2603.01234v2" rel="alternate" type="text/html" />
    <link href="https://arxiv.org/pdf/2603.01234v2" rel="related" title="pdf" type="application/pdf" />
    <category term="cs.AI" />
    <category term="cs.IR" />
    <arxiv:comment>Benchmarked on enterprise support workflows.</arxiv:comment>
    <arxiv:journal_ref>Proc. Example Systems 2026</arxiv:journal_ref>
    <arxiv:doi>10.1234/example.2026.12345</arxiv:doi>
    <arxiv:primary_category term="cs.AI" />
  </entry>
</feed>`;

describe("arXiv parsers", () => {
  it("parses daily RSS items into canonical feed entries", () => {
    const entries = parseDailyFeed(dailyFeedXml, "cs.AI");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      arxivId: "2603.01234",
      version: 2,
      versionedId: "2603.01234v2",
      announcementDay: "2026-03-11",
      announceType: "new",
      categories: ["cs.AI", "cs.IR"],
      sourceFeedCategories: ["cs.AI"],
      feedCategory: "cs.AI",
    });
  });

  it("parses Atom API responses into hydrated paper records", () => {
    const papers = parseAtomFeed(atomFeedXml);

    expect(papers).toHaveLength(1);
    expect(papers[0]).toMatchObject({
      arxivId: "2603.01234",
      version: 2,
      versionedId: "2603.01234v2",
      title: "Practical Agentic Search for Enterprise Workflows",
      abstract:
        "We introduce a retrieval pipeline for enterprise knowledge work. It improves latency and budget discipline.",
      authors: ["Alice Example", "Bob Example"],
      categories: ["cs.AI", "cs.IR"],
      sourceFeedCategories: [],
      primaryCategory: "cs.AI",
      announcementDay: "2026-03-10",
      comment: "Benchmarked on enterprise support workflows.",
      journalRef: "Proc. Example Systems 2026",
      doi: "10.1234/example.2026.12345",
      links: {
        abs: "https://arxiv.org/abs/2603.01234v2",
        pdf: "https://arxiv.org/pdf/2603.01234v2",
      },
    });
  });

  it("extracts the abstract body from RSS descriptions", () => {
    expect(
      extractAbstractFromDailyDescription(
        "arXiv:2603.01234v2 Announce Type: new Abstract: Budget-aware orchestration matters.",
      ),
    ).toBe("Budget-aware orchestration matters.");
  });

  it("builds historical queries with submittedDate windows", () => {
    expect(buildHistoricalQuery(["cs.AI", "cs.IR"], "2026-03-01", "2026-03-02")).toBe(
      "(cat:cs.AI OR cat:cs.IR) AND submittedDate:[202603010000 TO 202603022359]",
    );
  });
});
