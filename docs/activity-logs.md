# Activity logs and reports

The Worker stores tracked activity in D1. It uses the same fields and summary rules as the previous JSONL logger. No cookies, raw IPs, health details, or third-party analytics are added by this code. Production remains on the old server until migration phase 4; do not import or remove its logs in phase 1.

## Storage

- Worker: the `activity` table in the `DB` D1 binding.
- Local development: persistent Miniflare D1 under `.local/wrangler-d1`.
- Reports: a JSON array of exported activity rows, or the local D1 rows directly.
- Mac availability history is separate: `app/.data/availability.sqlite`. Use `pnpm availability:report` for it.

The Worker also writes activity JSON to its console. Native Cloudflare logs are useful for short-term diagnosis but have Free ingestion and retention limits. D1 is the activity store for these reports.

## Limits and retention

POST bodies are limited to 1 KB for `/api/events` and 64 KB for `/mcp`. The reader counts bytes, including streamed bodies with absent or false Content-Length. Larger bodies return HTTP 413. MCP calls are logged only for known tool names. Event bodies accept only the existing event-name allowlist and human user agents.

A daily cron pass removes activity before UTC midnight 180 days before the current UTC date. The boundary day is kept, as in the previous file-retention rule. The pass also deletes salts for earlier Denver dates. Its completion is stored in D1; an isolate restart does not repeat that day's cleanup. Cleanup failure is logged, leaves the pass eligible for retry, and does not stop the availability refresh.

## Row fields

| Field | Meaning |
|---|---|
| `t` | ISO timestamp in UTC |
| `k` | `request`, `event`, or `mcp` |
| `p` | Logged path |
| `a` | `human`, `ai-agent`, `search-bot`, or `other-bot` |
| `an` | Recognized agent or bot name |
| `v` | Twelve-character anonymous visitor hash for people |
| `c` | Country from the Cloudflare header |
| `r` | External referrer hostname only |
| `md` | Whether the request asked for Markdown |
| `e` | Allowed event name |
| `tool` | Known MCP tool name |
| `via` | `webmcp` for a browser-agent tool call |

D1 adds an internal numeric row ID; the report does not use it. Optional SQL columns are null. The report removes nulls and reads SQLite's Markdown flag as a boolean.

A visitor hash uses the IP and user agent with a random salt for the America/Denver date. The IP and raw user agent are never stored in the activity row. The `visitor_salts` table holds one salt per Denver date so separate isolates produce the same visitor ID. Do not include salts in an activity export. Hashes cannot link a visitor across dates.

Logged requests include `/`, `/book`, and the named agent/API surfaces. Assets and scanner probes are not activity rows. `/book` sends `book_page_view` on client-side route entry. Direct SSR loads use the request row only. Hydration and filter changes do not add a page view.

Homepage `*_book_page_click` events are navigation, not official scheduler visits. Time picks on `/book`, current `*_scheduler_click` fallback links, and earlier `*_schedule_click` events count as official scheduler visits. Calls and callback requests remain separate. A click is not a confirmed appointment.

## Local reports

Run these commands from the repository root:

```sh
pnpm activity:report --days=7
pnpm activity:report --days=30 --json
pnpm activity:export .local/activity-export.json
pnpm activity:report --file=.local/activity-export.json --days=7
pnpm activity:report --file=.local/activity-export.json --days=30 --json
```

The first two commands read local D1 without fetching NextPatient. The export command writes a new JSON file and refuses to overwrite an existing file. Choose a new path for each export. Reporting from a JSON file needs Node 24 and installed dependencies, but no running Worker or credentials.

## Production export (authorized operations only)

After the approved cutover, use the protected operations context to export only activity rows. Do not load credentials for development. One example, to run only after authorization:

```sh
pnpm exec wrangler d1 execute drhoodskin --remote --command 'SELECT * FROM activity ORDER BY t, id' --json > activity-d1-result.json
jq '.[0].results' activity-d1-result.json > activity-export.json
pnpm activity:report --file=activity-export.json --days=7
```

Inspect the command result before using the report. The report input must be the row array, not Wrangler's result wrapper or a SQL database export. Keep exports private and delete them under the operator's retention policy. Do not commit them.

The summary includes home and booking-page views, visitor-days, booking actions and rate, named events, referrers, countries, AI agents and paths, search bots, MCP tools, and Markdown requests. Visitors and booking visitors are counted once per Denver day and summed across days. The booking rate is booking visitor-days divided by all visitor-days. Timestamps remain UTC.

Importing the server's earlier JSONL rows and changing the scheduled report task are migration phases 4 and 5, not part of the local port.
