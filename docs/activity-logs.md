# Activity logs and reports

The app writes one JSON line per tracked activity. No cookies, no IP addresses, no third-party analytics. Use Cloudflare's free dashboard (Analytics, Web analytics, Observability → Logs, AI Crawl Control) for overall traffic, countries, bots, and 30 days of raw request logs. Use these logs for what Cloudflare cannot see: booking clicks inside the page and MCP tool use.

## Where

- Production: `LOG_DIR=/app/data/logs` in the container, mounted from `./data` next to `compose.yaml`. One file per UTC day: `activity-YYYY-MM-DD.jsonl`. Lines also go to stdout (`docker compose logs`).
- Local preview: `app/.data/logs`.

## Limits

POST request bodies are limited to 1 KB for `/api/events` and 64 KB for `/mcp`. Larger bodies return HTTP 413, even when `Content-Length` is absent or too small. MCP tool calls are logged only for known tool names.

Docker stdout logs use the `json-file` driver with a 10 MB limit per file and at most three files. Daily JSONL files in `LOG_DIR` keep the current UTC day and the previous 180 days. The first successful write after startup or on a new UTC day starts background cleanup. Cleanup uses the date in each file name, not its modification time, and deletes only regular files named exactly `activity-YYYY-MM-DD.jsonl` directly in `LOG_DIR`. It does not follow symlinks or enter subdirectories. Cleanup errors go to stderr and do not stop activity writes.

## What a line contains

| Field  | Meaning                                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`    | ISO time (UTC)                                                                                                                                                                                                                  |
| `k`    | `request` (page or agent file), `event` (click or client-side booking-page arrival), `mcp` (MCP tool call)                                                                                                                      |
| `p`    | path                                                                                                                                                                                                                            |
| `a`    | `human`, `ai-agent`, `search-bot`, `other-bot` (from the user agent)                                                                                                                                                            |
| `an`   | agent or bot name, for example `ChatGPT-User`, `Googlebot`                                                                                                                                                                      |
| `v`    | anonymous visitor ID for people: a hash of IP, user agent, and a random salt that changes on each America/Denver calendar date and is never stored. Counts unique visitors per Denver day; cannot link days or identify anyone. |
| `c`    | country (Cloudflare header)                                                                                                                                                                                                     |
| `r`    | external referrer host                                                                                                                                                                                                          |
| `md`   | request asked for Markdown                                                                                                                                                                                                      |
| `e`    | event name, for example `hero_schedule_click` or `book_page_view`                                                                                                                                                               |
| `tool` | MCP tool name                                                                                                                                                                                                                   |
| `via`  | `webmcp` when a browser agent called the tool through WebMCP on the homepage                                                                                                                                                    |

Logged requests: `/`, the booking page `/book`, and the agent files (`/llms.txt`, `/.well-known/*`, `/api/*`, `/mcp`, `/openapi.json`, `/sitemap.xml`). Assets and scanner probes are not logged. Events are accepted only from people and only for known names. The `/book` route sends `book_page_view` when client-side navigation enters the page. Server-rendered loads use the request log only; hydration, preloading, and filter changes do not add a page view. Homepage booking buttons (`hero_book_page_click`, `closing_book_page_click`, `header_book_page_click`, `sticky_book_page_click`) open `/book` and do not count as official scheduler visits. The earlier homepage `*_schedule_click` events and the current fallback `*_scheduler_click` events count as official scheduler visits. Booking page events: `book_schedule_click`, `book_early_schedule_click` (a time flagged earlier than usual), `book_call_click`, `book_callback_click`, `book_filter_change`, `book_visit_switch`, `book_switch_note_click`.

## Report

```sh
# on the server
docker compose exec drhoodskin node scripts/activity-report.ts --days=7
docker compose exec drhoodskin node scripts/activity-report.ts --days=30 --json

# locally, from app/
npm run activity:report -- --days=7
```

The report shows page views (home and booking page), unique visitors per day, booking actions (official scheduler visits: a time picked on `/book` or the fallback link; callback; call) and the share of visitors who took one, events by name, referrers, countries, AI agents and the paths they read, search bots, MCP tool calls (WebMCP calls are marked), and Markdown requests. A booking click is not a completed appointment; USDP's scheduler confirms appointments.

Visitors are people who view `/` or `/book`, counted once per America/Denver calendar day and summed across days. Booking-page views include server GET requests to `/book` and client-side `book_page_view` events. These events do not count as booking actions. Visitors who take a booking action are also counted once per Denver day. The booking rate divides those visitor-days by all visitor-days. Denver days apply to report grouping and visitor-salt rotation only; timestamps and JSONL file names stay in UTC.
