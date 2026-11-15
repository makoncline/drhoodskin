# Activity logs and reports

The app writes one JSON line per tracked activity. No cookies, no IP addresses, no third-party analytics. Use Cloudflare's free dashboard (Analytics, Web analytics, Observability → Logs, AI Crawl Control) for overall traffic, countries, bots, and 30 days of raw request logs. Use these logs for what Cloudflare cannot see: booking clicks inside the page and MCP tool use.

## Where

- Production: `LOG_DIR=/app/data/logs` in the container, mounted from `./data` next to `compose.yaml`. One file per UTC day: `activity-YYYY-MM-DD.jsonl`. Lines also go to stdout (`docker compose logs`).
- Local preview: `app/.data/logs`.

## What a line contains

| Field | Meaning |
|---|---|
| `t` | ISO time (UTC) |
| `k` | `request` (page or agent file), `event` (click in the page), `mcp` (MCP tool call) |
| `p` | path |
| `a` | `human`, `ai-agent`, `search-bot`, `other-bot` (from the user agent) |
| `an` | agent or bot name, for example `ChatGPT-User`, `Googlebot` |
| `v` | anonymous visitor ID for people: a hash of IP, user agent, and a random salt that changes each day and is never stored. Counts unique visitors per day; cannot link days or identify anyone. |
| `c` | country (Cloudflare header) |
| `r` | external referrer host |
| `md` | request asked for Markdown |
| `e` | click event name, for example `hero_schedule_click` |
| `tool` | MCP tool name |
| `via` | `webmcp` when a browser agent called the tool through WebMCP on the homepage |

Logged requests: `/`, the booking page `/book`, and the agent files (`/llms.txt`, `/.well-known/*`, `/api/*`, `/mcp`, `/openapi.json`, `/sitemap.xml`). Assets and scanner probes are not logged. Click events are accepted only from people and only for known names. Homepage booking buttons (`hero_`, `closing_`, `header_`, `sticky_schedule_click`) open `/book`; `*_scheduler_click` is the fallback link to the USDP scheduler. Booking page events: `book_schedule_click`, `book_early_schedule_click` (a time flagged earlier than usual), `book_call_click`, `book_callback_click`, `book_filter_change`, `book_visit_switch`, `book_switch_note_click`.

## Report

```sh
# on the server
docker compose exec drhoodskin node scripts/activity-report.ts --days=7
docker compose exec drhoodskin node scripts/activity-report.ts --days=30 --json

# locally, from app/
npm run activity:report -- --days=7
```

The report shows page views (home and booking page), unique visitors per day, booking actions (official scheduler visits: a time picked on `/book` or the fallback link; callback; call) and the share of visitors who took one, clicks by event, referrers, countries, AI agents and the paths they read, search bots, MCP tool calls (WebMCP calls are marked), and Markdown requests. A booking click is not a completed appointment; USDP's scheduler confirms appointments.
