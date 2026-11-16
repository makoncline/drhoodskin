# Development

Use Node 24.22.3 or a later patched Node 24 and pnpm 10.29.2. Run commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm browser:install
pnpm dev
pnpm check
```

## Built-server development

`pnpm dev` builds the real Node/Nitro production entry and starts it with a fixture-only outbound fetch preload. Read `.local/ready.json` for the URL, PID, and activity directory. Source changes rebuild and restart on the same port. Reload after the ready message. Stop with Ctrl-C.

Only NextPatient's read-only schedule requests for this practice, provider, and visit types are replaced. Other outbound server traffic is blocked. No booking links are opened. The fixture runs in a local HTTP service outside application code; its controls are not part of the production bundle.

Local dev activity is stored in `.local/dev-logs`. A restart keeps it. `pnpm dev:reset` refuses while the server is running and moves existing local dev logs to a dated backup. It does not reset the Mac poller's SQLite history.

No production credentials or server access are needed for development. The development/check commands refuse deployment secrets in their environment.

## Checks

`pnpm check` runs lint, then the production build and helper/E2E tests, then TypeScript. The E2E harness starts real built Node child processes and real temporary JSONL storage. It replaces only outbound NextPatient requests and blocks unexpected network traffic.

The workflows cover:

- Patient navigation, day/time/busy-hour filters, Reset, visit switching, and official scheduler handoff links.
- Server-rendered appointment links and error fallbacks without JavaScript.
- REST/MCP parity, discovery surfaces, Markdown negotiation, input errors, and declared/chunked body limits.
- Shared API/SSR cache reads, cold single-flight loading, dense schedules, markup drift, redirect rejection, and Mac parser/history compatibility.
- Persisted activity, visitor identity across process restarts, storage failure, and real CLI exports/reports.

Focused helper tests cover fake-clock cache backoff/expiry and real-file retention boundaries without waiting for production time intervals. No application modules or persistence stores are mocked.

Browser tests block external requests, including Google Maps, rather than simulating them. The blank map in screenshots is expected. Unexpected requests, page errors, and horizontal overflow fail the check.

## Evidence

`test-results/report.json` records the checked revision, dirty-tree flag, results, screenshots, and diagnostic logs. A dirty run is not evidence for an unchanged commit; CI must verify the actual PR/release revision. Open these four files before claiming visual completion:

- `test-results/e2e/home-desktop.png`
- `test-results/e2e/home-mobile.png`
- `test-results/e2e/book-desktop.png`
- `test-results/e2e/book-mobile.png`

These screenshots use synthetic times, not live availability. Keep exports private and out of Git and Docker contexts. Do not publish visitor salts or raw diagnostic data.

## Reports and Mac poller

```sh
LOG_DIR=.local/dev-logs pnpm activity:report --days=7
LOG_DIR=.local/dev-logs pnpm activity:export .local/activity-export.json
pnpm activity:report --file=.local/activity-export.json --days=7 --json
pnpm availability:report
```

The export command writes a new mode-0600 JSON array and refuses to overwrite an existing file. Without `LOG_DIR`, report/export commands read `.data/logs`.

The Mac poller remains at `app/scripts/poll-availability.ts` and uses `app/.data/availability.sqlite`. Its launchd job is unchanged. `pnpm availability:poll` performs real read-only requests; checks do not run it.

## Hosting boundaries

The UI, portable parser, HTTP contracts, byte reader, report calculations, and external-service fixtures can support another host later. Node persistence and the process cache are isolated in their own modules. The current app has no D1, Miniflare, Wrangler, or alternate Worker runtime. Historical Cloudflare findings remain in `docs/cloudflare-migration.md` and Git history.
