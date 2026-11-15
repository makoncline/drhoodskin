# Development

Use Node 24 and the pinned pnpm 10.29.2. Work from the repository root.

```sh
bash scripts/cloud-setup.sh
pnpm dev
pnpm check
```

Setup installs dependencies and Chromium, then runs the check. Linux needs Chromium's system libraries. CI uses the pinned Playwright container. In a Cloud workspace with a read-only home, set `PATH="$PWD/.local/bin:$PATH"`, `COREPACK_HOME="$PWD/.local/corepack"`, and `PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers"` before setup and in later shells.

## Runtime

`pnpm dev` builds the production entry and runs it in Miniflare. It stores local D1 at `.local/wrangler-d1`. Read `.local/ready.json` for the current URL, PID, and log path. Source changes rebuild and restart on the same port. Reload after the ready message. Stop with Ctrl-C. `pnpm dev:reset` removes local D1 and refuses while the app is running.

The local runtime runs the real scheduled handler twice at startup, once for each visit type, then once per minute. NextPatient is replaced only at the outbound fetch boundary. Other outbound Worker traffic is blocked. The fixture accepts only the read-only `schedule.json` URL for this practice, provider, and two reasons. It never follows or opens booking links.

No Cloudflare, GitHub, or production credentials are needed. Dev and check scripts refuse deployment credentials in the environment. Local development does not deploy or use a remote database. The build uses the official Cloudflare Vite plugin.

## Persistence and tests

Edit `db/schema.ts`, run `pnpm db:generate`, inspect the SQL and snapshot, and commit the migration. Do not edit an applied migration. Wrangler's `migrations_pattern` reads the generated `db/migrations/*/migration.sql` layout. Both E2E setup and production use the real `wrangler d1 migrations apply` command and its `d1_migrations` bookkeeping. E2E uses `--local` with an isolated persistence path, then starts Miniflare against that same D1 storage. The initial migration adds the two due visit rows.

`pnpm check` runs:

1. The Vite+ production build.
2. Pure helper tests for filtering, early openings, report math, byte limits, and Mac SQLite history.
3. Eight end-to-end workflows through the built Worker in Miniflare, with real local D1.
4. TypeScript.

The workflows cover public agent surfaces, Markdown and link headers, REST/MCP validation and filter round trips, streamed request limits, allowed events, D1 visitor salts across restarts, retention and exported reports, browser navigation, SSR without JavaScript, cron budgets, backoff, stale data, markup drift, and recovery. Tests seed historical D1 rows only for retention and expiry cases. They do not substitute application code. The Node parser test replaces only the NextPatient fetch boundary and records its result through the real Mac SQLite store.

HTTP transport rejects false Content-Length before a request reaches the Worker. E2E tests use real declared lengths and chunked bodies. The shared byte-reader tests cover false lengths, exact byte boundaries, and stream cancellation directly.

Browser tests block external requests. The existing Google Maps iframe is blocked rather than simulated, so it is blank in screenshots. All other unexpected requests, page errors, and horizontal overflow fail the check. No appointment booking links are opened.

## Evidence

`test-results/report.json` records the tested Git revision, checks, screenshots, and diagnostic logs. Open these four files before claiming visual completion:

- `test-results/e2e/home-desktop.png`
- `test-results/e2e/home-mobile.png`
- `test-results/e2e/book-desktop.png`
- `test-results/e2e/book-mobile.png`

These screenshots use synthetic appointment times. Do not present them as live availability. Native request logs and activity entries are in `test-results/e2e/*.logs.json`. `.local/requests.jsonl` records local dev logs. Request diagnostics use `X-Correlation-ID`; they exclude query strings, raw bodies, IPs, and raw user agents.

Miniflare does not prove Cloudflare CPU use. Measure `/`, `/book`, and a full cron pass on the Free plan during migration phase 3. Do not replace SSR or enable paid features without a new decision.

## Local reports and Mac poller

```sh
pnpm activity:report --days=7
pnpm activity:export .local/activity-export.json
pnpm activity:report --file=.local/activity-export.json --days=7 --json
pnpm availability:report
```

The Mac poller remains at `app/scripts/poll-availability.ts`, with local data at `app/.data/availability.sqlite`. Its existing launchd command remains valid. It imports the same parser as the Worker and runs on Node 24 without a DOM library. Do not move its data or change its launchd job in this phase. `pnpm availability:poll` performs a real read-only poll; local checks never run it.
