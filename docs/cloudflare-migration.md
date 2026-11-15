# Move drhoodskin.com to Cloudflare Workers

Owner decision (2026-11-15): host the site on Cloudflare Workers and remove it from makon-dev-0. On-server Docker builds OOM-killed other production apps twice on 2026-11-15. The site is not critical infrastructure; short outages during the move are acceptable.

## Decisions

- **Keep this repository.** Port the startup-template's runtime and deployment method into it (Alchemy, Cloudflare Worker and D1, Vite+, pnpm, Node 24, Miniflare E2E, protected manual deploy through 1Password and Varlock). Do not copy the template's product code (Stripe, Better Auth, Resend). Reference: `/Users/makon/dev/startup-template` at `ad001e7`.
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
- Alchemy is beta, and this is the template's first production deploy.
