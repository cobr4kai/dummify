# PaperBrief

PaperBrief is an operator-focused AI research brief. It is not a generic "top arXiv papers" feed and not a researcher tool for academics. The product ingests new arXiv papers, scores them for operator relevance, and turns the strongest candidates into skeptical executive briefs for strategy, finance, operations, procurement, and product teams.

## What This Pass Implements

- default ingest scope tuned to `cs.AI`, `cs.LG`, `cs.CL`, `cs.MA`
- richer official arXiv metadata capture on each `Paper`
- feed provenance tracking for cross-listed papers
- conservative request pacing, retries, and file-backed HTTP caching
- two-step scheduler with a primary daily ingest and a later reconciliation pass
- shortlist scoring tuned toward business consequences rather than prestige
- a reserved historical backfill seam for later OAI-PMH support

## Ingestion Architecture

The ingestion flow is intentionally official-interface-first:

1. Discover fresh papers from the category RSS feeds.
2. Hydrate canonical metadata from `export.arxiv.org`.
3. Deduplicate by canonical arXiv identifier.
4. Persist one `Paper` record plus merged source-feed provenance.
5. Compute the canonical shortlist score.
6. Generate executive briefs only for the top shortlisted papers.
7. Fetch PDFs only for papers that survive shortlist selection.

What we use:

- Fresh discovery: `https://rss.arxiv.org/rss/{category}`
- Metadata hydration and historical search: `https://export.arxiv.org/api/query`
- Future bulk backfill seam: [backfill.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/arxiv/backfill.ts)

What we explicitly do not use:

- no HTML scraping of arXiv listing pages
- no crawling human-facing paper index pages
- no bulk PDF downloading before shortlist selection
- no PDF redistribution from this product

## Category Scope

Enabled by default:

- `cs.AI`
- `cs.LG`
- `cs.CL`
- `cs.MA`

Available but disabled by default:

- `cs.CV`
- `cs.RO`
- `cs.IR`
- `cs.CY`
- `stat.ML`

Category state is stored in `CategoryConfig` and can be edited from the admin UI.

## Exact Feed URLs and API Query Patterns

RSS feeds used for daily discovery:

- [cs.AI](https://rss.arxiv.org/rss/cs.AI)
- [cs.LG](https://rss.arxiv.org/rss/cs.LG)
- [cs.CL](https://rss.arxiv.org/rss/cs.CL)
- [cs.MA](https://rss.arxiv.org/rss/cs.MA)

Daily hydration query pattern:

```text
https://export.arxiv.org/api/query?id_list=<comma-separated canonical ids>&start=0&max_results=<batch size>
```

Historical metadata query pattern:

```text
https://export.arxiv.org/api/query?search_query=(cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.MA) AND submittedDate:[YYYYMMDD0000 TO YYYYMMDD2359]&sortBy=submittedDate&sortOrder=descending&start=<offset>&max_results=100
```

The historical path currently uses the export API through [client.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/arxiv/client.ts). The later OAI-PMH handoff point lives in [backfill.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/arxiv/backfill.ts).

## Metadata Stored Per Paper

`Paper` now preserves:

- `arxivId`
- `version`
- `versionedId`
- `title`
- `abstract`
- `authors`
- `publishedAt`
- `updatedAt`
- `primaryCategory`
- `categories`
- `comment`
- `journalRef`
- `doi`
- `announcementDay`
- `announceType`
- `abs_url`
- `pdf_url`
- `sourceFeedCategories`
- `firstSeenAt`

Cross-listed papers are deduplicated by canonical `arxivId`. The app keeps one paper record and merges all feed categories where the paper first appeared.

## Rate Limiting, Retry, and Cache Policy

The arXiv client is intentionally conservative:

- RSS discovery and API hydration use separate pacing lanes
- API requests default to a `3100ms` minimum sequential delay
- RSS requests default to a `1000ms` minimum sequential delay
- retries apply exponential backoff for `403`, `429`, and `5xx`
- non-retryable statuses fail immediately
- repeated responses are cached on disk by request URL hash

HTTP cache location:

```text
<pdfCacheDir>/http/arxiv/rss/<sha256(url)>.json
<pdfCacheDir>/http/arxiv/api/<sha256(url)>.json
```

Default cache TTLs:

- RSS feeds: `60` minutes
- API responses: `180` minutes

## Scheduling

PaperBrief follows arXiv's announcement cadence rather than pretending the corpus updates uniformly all day.

Default schedules, interpreted in `America/Los_Angeles`:

- primary ingest: `15 17 * * 0-4`
- reconcile ingest: `45 20 * * 0-4`

That maps to:

- primary job at 5:15 PM Pacific, Sunday through Thursday
- reconcile job at 8:45 PM Pacific, Sunday through Thursday

Friday and Saturday zero-paper runs are treated as expected quiet days, not operational failures.

The secure cron route remains:

- `POST /api/cron/daily-refresh`

Accepted query params:

- `job=primary|reconcile`
- `day=YYYY-MM-DD`

Auth:

- bearer token must match `CRON_SECRET`

## Config Knobs

Runtime settings live in `AppSetting` and are editable from the admin UI:

- `primaryCronSchedule`
- `reconcileCronSchedule`
- `reconcileEnabled`
- `rssMinDelayMs`
- `apiMinDelayMs`
- `retryBaseDelayMs`
- `feedCacheTtlMinutes`
- `apiCacheTtlMinutes`
- `genAiShortlistSize`
- `genAiFeaturedCount`
- `highBusinessRelevanceThreshold`
- `genAiRankingWeights`
- `pdfCacheDir`

Defaults live in [defaults.ts](/C:/Users/manee/OneDrive/Desktop/dummify/config/defaults.ts).

## Scoring and Shortlisting

The shortlist score is built to favor papers with operator consequences, not prestige alone. Positive signals include:

- agents, tool use, reasoning, workflow automation
- evaluation, reliability, and benchmark quality
- training efficiency, data efficiency, and scaling implications
- inference latency, throughput, memory, and serving cost
- platform, orchestration, governance, and deployment implications
- cost curves, vendor leverage, and enterprise workflow effects

Negative signals include:

- narrow benchmark tweaks
- survey/tutorial filler
- theory-heavy papers without usable evidence
- speculative or simulation-only claims

Cross-listing across the core operator feeds adds a bonus because it often signals broader relevance than a narrow niche result.

## Data Model

This pass keeps the MVP schema shape:

- `Paper`
- `PaperScore`
- `PaperTechnicalBrief`
- `PaperPdfCache`
- `PaperEnrichment`
- `IngestionRun`
- `CategoryConfig`
- `AppSetting`

Compatibility baggage retained but not active:

- `PaperSummary`

See [schema.prisma](/C:/Users/manee/OneDrive/Desktop/dummify/prisma/schema.prisma).

## Local Setup

```bash
npm install
node scripts/bootstrap-db.mjs
npx prisma generate
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If you prefer the Prisma migration flow and your environment supports it cleanly, you can still use it. For this repo's checked-in SQLite workflow, the bootstrap script is the safest default on Windows.

## ChatGPT App / MCP

This repo now also exposes a read-only MCP endpoint for ChatGPT from the existing Next.js app.

Live endpoint shape:

- `POST /api/mcp`
- `GET /api/mcp` returns method-not-allowed
- `DELETE /api/mcp` returns method-not-allowed
- `GET /api/mcp/health`

The MCP route reuses the same content-normalization logic as the site and returns safe-summary article data only.

Local commands from the repo root:

```bash
npm run dev
npm run test:mcp
```

For ChatGPT connector testing against a deployed site, use your existing Render/onrender hostname with `/api/mcp`.

## Render Production

This repo now includes a Render blueprint at [render.yaml](/C:/Users/manee/OneDrive/Desktop/dummify/render.yaml) plus Render-specific helper scripts in [render-start.mjs](/C:/Users/manee/OneDrive/Desktop/dummify/scripts/render-start.mjs) and [render-trigger-cron.mjs](/C:/Users/manee/OneDrive/Desktop/dummify/scripts/render-trigger-cron.mjs).

Production shape:

- one Render `web` service
- one persistent disk mounted at `/var/data`
- one local SQLite file at `file:/var/data/paperbrief.db`
- one cache root at `/var/data/paperbrief-cache`
- two Render `cron` services that call the app's secure cron endpoint over the private network

Why this shape:

- the app writes PDFs and extracted page text to local storage
- the app already exposes a secure cron route
- Render cron jobs do not need direct database or disk access if they trigger the web service over HTTP

Deploy steps:

1. Create a new Render Blueprint from this repo.
2. Keep the web service on a single instance and attach the persistent disk declared in `render.yaml`.
3. Set the required secrets in Render:
   - `OPENAI_API_KEY`
   - `ADMIN_PASSWORD`
   - optionally `OPENALEX_API_KEY`
4. Deploy the stack.
5. Log into `/admin` and confirm category settings, shortlist size, and cache path.

Operational notes:

- `DATABASE_URL` defaults to `file:/var/data/paperbrief.db` in the blueprint.
- `PAPERBRIEF_CACHE_DIR` defaults to `/var/data/paperbrief-cache` in the blueprint and seeds the initial app setting.
- the startup command bootstraps SQLite migrations on the mounted disk before `next start`
- you can opt into a one-time historical bootstrap backfill by setting:
  - `PAPERBRIEF_BOOTSTRAP_BACKFILL_FROM=2026-03-11`
  - `PAPERBRIEF_BOOTSTRAP_BACKFILL_TO=2026-03-11`
  - `PAPERBRIEF_BOOTSTRAP_BACKFILL_RECOMPUTE_BRIEFS=true`
  - optionally `PAPERBRIEF_BOOTSTRAP_BACKFILL_CATEGORIES=cs.AI,cs.LG,cs.CL,cs.MA`
  - the web startup path records completion in the production SQLite database and skips repeats on later deploys against the same disk
- health checks use `GET /api/health`
- the ChatGPT MCP endpoint is served from the same web service at `POST /api/mcp`
- Render cron schedules are expressed in UTC, so the provided jobs approximate the Pacific-time cadence but will shift by one hour across DST boundaries unless you update the schedules seasonally
- this SQLite-plus-disk setup is intended for a single web service instance, not horizontal scaling

If you later move to a remote libSQL/Turso database, the Render start script will skip local SQLite bootstrapping automatically, but you should then manage schema setup outside the web startup path.

## Environment Variables

See [.env.example](/C:/Users/manee/OneDrive/Desktop/dummify/.env.example).

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_EXTRACTION_MODEL`
- `OPENAI_SYNTHESIS_MODEL`
- `OPENAI_ENABLE_PREMIUM_SYNTHESIS`
- `OPENALEX_API_KEY`
- `ADMIN_PASSWORD`
- `CRON_SECRET`
- `ENABLE_LOCAL_CRON`
- `PAPERBRIEF_CACHE_DIR`
- `PAPERBRIEF_BOOTSTRAP_BACKFILL_FROM`
- `PAPERBRIEF_BOOTSTRAP_BACKFILL_TO`
- `PAPERBRIEF_BOOTSTRAP_BACKFILL_RECOMPUTE_BRIEFS`
- `PAPERBRIEF_BOOTSTRAP_BACKFILL_CATEGORIES`
- `PAPERBRIEF_BOOTSTRAP_BACKFILL_KEY`

## Tests

```bash
npm test
npm run lint
npm run build
```

Coverage now includes:

- RSS and Atom parser metadata extraction
- cache/retry behavior for official arXiv requests
- canonical dedupe and metadata persistence in ingestion
- quiet-day and reconcile ingestion behavior
- shortlist scoring, cross-list bonuses, and evidence weighting
- admin auth and redirect safety
- enrichment reuse and date handling regressions

## Important Constraints

- official arXiv RSS and export API first
- no HTML scraping
- no pre-shortlist bulk PDF harvesting
- no PDF redistribution
- abstract-only fallback when PDF extraction fails
- executive briefs remain the single active summary mode

## Key Files

- arXiv client: [client.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/arxiv/client.ts)
- backfill seam: [backfill.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/arxiv/backfill.ts)
- parser layer: [parsers.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/arxiv/parsers.ts)
- ingestion orchestration: [service.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/ingestion/service.ts)
- scoring heuristics: [service.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/scoring/service.ts)
- scoring keywords: [keywords.ts](/C:/Users/manee/OneDrive/Desktop/dummify/src/lib/scoring/keywords.ts)
- admin settings: [page.tsx](/C:/Users/manee/OneDrive/Desktop/dummify/src/app/admin/page.tsx)
- defaults: [defaults.ts](/C:/Users/manee/OneDrive/Desktop/dummify/config/defaults.ts)
