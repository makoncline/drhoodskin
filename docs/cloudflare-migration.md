# Move drhoodskin.com to Cloudflare Workers

Owner decision (2026-11-15): host the site on Cloudflare Workers and remove it from makon-dev-0. On-server Docker builds OOM-killed other production apps twice on 2026-11-15. The site is not critical infrastructure; short outages during the move are acceptable.

## Decisions

- **Keep this repository; use the official Cloudflare path.** Owner-approved change on 2026-11-15: use TanStack Start with `@cloudflare/vite-plugin`, `wrangler.jsonc`, D1, Drizzle migrations, Vite+, pinned pnpm, Node 24, and the existing Miniflare E2E method. Deploy with Wrangler from the main-only GitHub `production` environment. Follow `/Users/makon/dev/grunge/.github/workflows/deploy.yml` for the push/manual deployment shape. Do not use Alchemy, a state Worker, 1Password, Varlock, or OP_TOKEN for this site. The startup-template at `ad001e7` remains a local-testing reference, not the deployment stack.
- **Workers Free only.** Limits per invocation: 10 ms CPU (cron too), 50 external subrequests, 6 concurrent outbound connections. 5 Cron Triggers per account. 100,000 requests per day. D1: 50 queries per invocation.
- **No scheduler traffic in the request path.** Pages, `/api/appointments`, and MCP read the latest availability from D1. One cron trigger refreshes one visit type per invocation, using at most about 35 subrequests. Each visit type is due after 4 minutes from 06:00 to 22:00 Mountain Time and after 30 minutes overnight. The backoff after failures is kept, stored in D1. The forced-refresh path goes away; the Refresh button re-reads D1.
- **Cheaper parsing.** Replace `node-html-parser` with Workers `HTMLRewriter` or plain string scanning. Fetch every window up to the horizon once, with no duplicate first window. Keep the markup-drift error.
- **Activity logs in D1.** Same fields as the JSONL entries. A daily visitor salt per Denver day is stored in D1 (each isolate keeps its own memory, so an in-memory salt would split visitors), and earlier salts are deleted. A daily cron pass deletes rows older than 180 days. The report reads exported rows with the existing summary code.
- **CPU.** Keep SSR. If measured CPU on `/` or `/book` regularly exceeds the limit, prerender `/` as a static asset and keep logging by running the Worker first for logged paths.

## Phases

| # | Phase | Exit criteria |
|---|---|---|
| 1 | Port locally, no deploy | `pnpm check` passes: build, typecheck, E2E against the real Worker in Miniflare with local D1, NextPatient stubbed at the outbound boundary. Desktop and mobile screenshots reviewed. Feature parity with production: pages, `/book`, API, MCP, events, agent files, Markdown negotiation, cron refresh, backoff, retention. |
| 2 | Approved account setup | Free D1 `drhoodskin`; GitHub `production` environment with main-only deployment protection and environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Keep the Actions limit at $0. The coordinator collects and sets the API token; the implementation agent stops when it is needed. |
| 3 | First deploy to workers.dev | Open a PR from `cf-migration`, wait for CI, and stop before merging. The coordinator reviews and merges. The main workflow runs checks, remote D1 migrations, Wrangler deploy, and the live check. Browser and agent checks pass on workers.dev. NextPatient answers Cloudflare requests. CPU is measured, and a repeat deployment is verified. |
| 4 | Cutover | Activity JSONL since 2026-11-14 imported into D1. Tunnel public hostname for drhoodskin.com removed and Worker custom domain attached. Browser and agent checks pass on https://drhoodskin.com. |
| 5 | Decommission | Server container stopped, `data/` archived, Caddy route removed. Server audit prompt drops its drhoodskin bullet. The 2026-11-23 report task reads D1. Docs and AGENTS.md updated. |
| 6 | Template fixes | PR to startup-template for each problem found during the first real production deploy. |

## Rollback

Until phase 5, the server stack stays installed. To roll back, restore the tunnel public hostname for drhoodskin.com and start the container.

## Risks

- NextPatient may block or challenge Cloudflare egress. Check first in phase 3.
- SSR CPU on Free. Measure in phase 3.
- Cron Trigger quota is per account. Check existing triggers in phase 2.
- This site's scheduler, cron workload, SSR CPU, and repeat deployment still need validation on workers.dev. Grunge proves the Wrangler release shape, not this app's D1 or scheduler behavior.

## Phase 1 implementation

The web app now lives at the repository root. The Worker handles the existing public server surfaces before TanStack Start. Request paths use D1 only. One minute cron trigger refreshes one due visit per invocation, with a maximum of 31 scheduler reads and six concurrent fetches. It stores due times, failure backoff, and the last usable snapshot in D1. The parser uses string scanning and still works in the Node 24 Mac poller at `app/scripts/poll-availability.ts`.

Activity rows, Denver-day salts, and daily retention state are in D1. `pnpm activity:report` reads local D1; `pnpm activity:export <new-json-path>` and `pnpm activity:report --file=<json-path>` support exported rows. The Node/Docker runtime files are removed from this branch, not from the running server.

Phase 1 was verified locally before account work. The initial deployment scaffold was then replaced by the official Cloudflare Vite adapter and Wrangler at the owner's direction. Local setup now applies the real Wrangler D1 migrations before starting the built Worker in Miniflare. See DEVELOPMENT.md and OPERATIONS.md.

## Approved pre-cutover setup, 2026-11-15

- Approved: Free D1 `drhoodskin`, Worker `drhoodskin`, one cron, and a main-only GitHub `production` environment. No DNS, custom-domain, tunnel, or server changes are approved.
- Created D1 `drhoodskin` (`788fd598-812f-4933-8334-a56d9d82d385`) with the logged-in local Wrangler CLI. Remote schema installation waits for the deployment job.
- Confirmed account `862f016642ad509483b546d81fc48f63` is on Workers Free. Existing Workers use one of five account Cron Triggers.
- The account workers.dev subdomain was `daylilycatalog.workers.dev` until 2026-11-16; it is now `makon.workers.dev`. The intended site URL is `https://drhoodskin.makon.workers.dev`, not yet deployed.
- Keep secret values out of source, logs, and chat. The coordinator installs `CLOUDFLARE_API_TOKEN`. The implementation agent can set the non-secret account ID, but must stop at the token prerequisite and must not merge the PR.

## Template findings

- `README.md`, `config/app.json`, `scripts/prepare-ops.js`, `src/worker.ts`: add a read-only app example that removes payments, auth, email, CSP provider rules, and unused secrets rather than requiring dummy settings.
- `alchemy.run.ts`, `src/worker.ts`, `scripts/dev/runtime.js`: add a cron example with `crons`, a `scheduled` handler, `getWorker().scheduled()` in Miniflare, D1 due-row claims, persisted backoff, and daily maintenance.
- `DEVELOPMENT.md`, `OPERATIONS.md`: state the Workers Free CPU, subrequest, connection, and D1-query limits; bound fan-out in tests and measure SSR and cron CPU after an authorized deploy.
- `alchemy.run.ts`, `scripts/launch-check.js`: support the first workers.dev deploy without attaching a custom domain; disable version-preview URLs when hosted previews are not used.
- `test/e2e/harness.js`: document that Miniflare's HTTP transport rejects false Content-Length before the Worker; test valid transport end to end and false lengths directly in the shared byte reader.
- `scripts/dev/watch.js`: skip waiting for an exit event from a child that has already exited; save the port before stopping a child that removes its ready file.
- `scripts/dev/start.js`, `scripts/dev/reset.js`: remove stale ready files on graceful shutdown and document that read-only apps do not need the auth fixture's local HTTPS setup.
- `package.json`, `pnpm-lock.yaml`: check peer ranges when updating the lock; the current ranges can resolve `@effect/sql-d1` against a newer Effect peer and Wrangler against newer Workers types.
- `scripts/live-check.js`: allow a bounded initial-cache warmup for cron-fed apps; wait for scheduled refreshes rather than adding a request-path fetch or forced refresh.
- `alchemy.run.ts`, `OPERATIONS.md`, protected deploy workflow: offer the official Cloudflare Vite plugin and Wrangler for a single Worker+D1 site; Alchemy beta churn and its state/1Password overhead are not justified here. This site now uses that simpler path.
- `wrangler.jsonc`, `scripts/dev/migrate.js`: use Wrangler's `migrations_pattern` for Drizzle's nested migration layout and run the real local migration command before Miniflare, with shared D1 IDs and persistence paths.
