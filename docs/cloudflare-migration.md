# Move drhoodskin.com to Cloudflare Workers

Owner decision (2026-11-15): host the site on Cloudflare Workers and remove it from makon-dev-0. On-server Docker builds OOM-killed other production apps twice on 2026-11-15. The site is not critical infrastructure; short outages during the move are acceptable.

## Decisions

- **Keep this repository.** Port the startup-template's runtime and deployment method into it (Alchemy, Cloudflare Worker and D1, Vite+, pnpm, Node 24, Miniflare E2E, protected manual deploy through 1Password and Varlock). Do not copy the template's product code (Stripe, Better Auth, Resend). Reference: `/Users/makon/dev/startup-template` at `ad001e7`. Use `/Users/makon/dev/home-cook-hotline` as the production reference for Alchemy, D1, protected deploys, and repeat releases. `/Users/makon/dev/grunge` is a separate production reference for the simpler Wrangler static-assets path.
- **Workers Free only.** Limits per invocation: 10 ms CPU (cron too), 50 external subrequests, 6 concurrent outbound connections. 5 Cron Triggers per account. 100,000 requests per day. D1: 50 queries per invocation.
- **No scheduler traffic in the request path.** Pages, `/api/appointments`, and MCP read the latest availability from D1. One cron trigger refreshes one visit type per invocation, using at most about 35 subrequests. Each visit type is due after 4 minutes from 06:00 to 22:00 Mountain Time and after 30 minutes overnight. The backoff after failures is kept, stored in D1. The forced-refresh path goes away; the Refresh button re-reads D1.
- **Cheaper parsing.** Replace `node-html-parser` with Workers `HTMLRewriter` or plain string scanning. Fetch every window up to the horizon once, with no duplicate first window. Keep the markup-drift error.
- **Activity logs in D1.** Same fields as the JSONL entries. A daily visitor salt per Denver day is stored in D1 (each isolate keeps its own memory, so an in-memory salt would split visitors), and earlier salts are deleted. A daily cron pass deletes rows older than 180 days. The report reads exported rows with the existing summary code.
- **CPU.** Keep SSR. If measured CPU on `/` or `/book` regularly exceeds the limit, prerender `/` as a static asset and keep logging by running the Worker first for logged paths.

## Phases

| # | Phase | Exit criteria |
|---|---|---|
| 1 | Port locally, no deploy | `pnpm check` passes: build, typecheck, E2E against the real Worker in Miniflare with local D1, NextPatient stubbed at the outbound boundary. Desktop and mobile screenshots reviewed. Feature parity with production: pages, `/book`, API, MCP, events, agent files, Markdown negotiation, cron refresh, backoff, retention. |
| 2 | Accounts (Makon) | Cloudflare account ID in config. API token in a drhoodskin Production 1Password Environment. OP_TOKEN in the GitHub `production` environment (main only, $0 Actions limit). New D1 database `drhoodskin`. |
| 3 | First deploy to workers.dev | Manual deploy job passes. Browser and agent checks pass on the workers.dev URL. NextPatient answers requests from Cloudflare. CPU time measured from Worker logs. |
| 4 | Cutover | Activity JSONL since 2026-11-14 imported into D1. Tunnel public hostname for drhoodskin.com removed and Worker custom domain attached. Browser and agent checks pass on https://drhoodskin.com. |
| 5 | Decommission | Server container stopped, `data/` archived, Caddy route removed. Server audit prompt drops its drhoodskin bullet. The 2026-11-23 report task reads D1. Docs and AGENTS.md updated. |
| 6 | Template fixes | PR to startup-template for each problem found during the first real production deploy. |

## Rollback

Until phase 5, the server stack stays installed. To roll back, restore the tunnel public hostname for drhoodskin.com and start the container.

## Risks

- NextPatient may block or challenge Cloudflare egress. Check first in phase 3.
- SSR CPU on Free. Measure in phase 3.
- Cron Trigger quota is per account. Check existing triggers in phase 2.
- Alchemy is beta. Home Cook Hotline already uses the template method in production; validate this site's scheduler, cron workload, and repeat deploy separately.

## Phase 1 implementation

The web app now lives at the repository root. The Worker handles the existing public server surfaces before TanStack Start. Request paths use D1 only. One minute cron trigger refreshes one due visit per invocation, with a maximum of 31 scheduler reads and six concurrent fetches. It stores due times, failure backoff, and the last usable snapshot in D1. The parser uses string scanning and still works in the Node 24 Mac poller at `app/scripts/poll-availability.ts`.

Activity rows, Denver-day salts, and daily retention state are in D1. `pnpm activity:report` reads local D1; `pnpm activity:export <new-json-path>` and `pnpm activity:report --file=<json-path>` support exported rows. The Node/Docker runtime files are removed from this branch, not from the running server.

Production fields in `config/app.json` remain empty. The protected manual release scaffold is present, but no credentials, resources, or deployment are part of phase 1. See DEVELOPMENT.md and OPERATIONS.md for the local checks and remaining account work.

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
