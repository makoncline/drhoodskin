# Activity logs and reports

The Node server writes activity as JSONL on the persistent VPS volume. The portable activity types and report calculations are shared with the previous Worker implementation. The Worker experiment's test traffic is not imported into production reports.

## Storage and privacy

- Production: `LOG_DIR=/app/data/logs`, mounted from `/srv/stacks/drhoodskin/data/logs`.
- Local dev: `.local/dev-logs`, recorded in `.local/ready.json`.
- Each UTC day has `activity-YYYY-MM-DD.jsonl`. Existing server files remain valid.
- Activity JSON is also written to container stdout, with Docker log rotation at 10 MB across three files.
- No raw IP address, raw user agent, cookies, health details, or appointment form data is stored.

For people, a visitor ID hashes the IP and user agent with a random salt for the America/Denver date. Only the twelve-character hash is written to activity rows. The salt is in `visitor-salt-YYYY-MM-DD`, created with mode 0600 in the same protected directory. It is not included in reports or exports. Persisting it keeps same-day visitor identity stable across app restarts and separate Nitro bundles. If the salt cannot be persisted or validated, logging continues with a process-local salt and a warning; restart stability is degraded, but activity still reaches stdout and any usable log storage.

Do not print salts, tokens, or raw diagnostic exports. Keep data, `.local`, credentials, and exports out of Git and Docker contexts.

## Retention

On the first successful write per UTC day, cleanup removes only valid `activity-YYYY-MM-DD.jsonl` files before UTC midnight 180 days earlier. The boundary day is kept. It also removes valid `visitor-salt-YYYY-MM-DD` files from earlier Denver dates.

Cleanup skips invalid dates, directories, symlinks, and unrelated filenames. Failures are logged without stopping the request or removing the log directory/volume. A failed cleanup remains eligible for retry.

## Fields

| Field | Meaning |
|---|---|
| `t` | ISO timestamp in UTC |
| `k` | `request`, `event`, or `mcp` |
| `p` | Logged path |
| `a` | `human`, `ai-agent`, `search-bot`, or `other-bot` |
| `an` | Recognized agent/bot name |
| `v` | Anonymous daily visitor hash |
| `c` | Country from the Cloudflare header |
| `r` | External referrer hostname only |
| `md` | Request asked for Markdown |
| `e` | Allowed event name |
| `tool` | Known MCP tool name |
| `via` | `webmcp` for browser-agent calls |

Logged requests include `/`, `/book`, and named agent/API surfaces. Assets and scanner probes are not activity rows. POST bodies are limited to 1 KB for events and 64 KB for MCP, including streamed bodies. Events accept only known names and human user agents. Unknown MCP tools are not logged.

The initial server-rendered booking page counts one request. Hydration adds no page view. Client-side pathname transitions into `/book` send `book_page_view`; filter changes do not. Both home and booking-page views contribute to visitor-day totals.

Homepage `*_book_page_click` events are navigation, not official scheduler visits. Slot picks, current `*_scheduler_click` fallback links, and earlier `*_schedule_click` events count as scheduler visits. Calls and callback requests remain separate. A click is not a confirmed appointment.

## Reports

From the repository root:

```sh
LOG_DIR=.local/dev-logs pnpm activity:report --days=7
LOG_DIR=.local/dev-logs pnpm activity:export .local/activity-export.json
pnpm activity:report --file=.local/activity-export.json --days=7 --json
```

On the VPS, without installing dependencies:

```sh
cd /srv/stacks/drhoodskin
docker compose exec -T drhoodskin node scripts/activity-report.ts --days=7
docker compose exec -T drhoodskin node scripts/activity-report.ts --days=30 --json
```

Without `LOG_DIR`, local report/export commands read `.data/logs`. Normal reports read only files in the requested date range, skip invalid lines or unreadable files, and print a skipped-count warning to stderr. A damaged old file cannot stop a recent report. Exports remain strict, write a new mode-0600 JSON array, and refuse to overwrite a file. Reporting from that array needs Node 24, not a running app or production credentials.

Reports show page views, visitor-days, booking actions/rate, events, referrers, countries, AI agents and paths, search bots, MCP tools, and Markdown requests. Visitor-days use America/Denver dates and cannot link a person across dates.

The Mac availability history is separate at `app/.data/availability.sqlite`; use `pnpm availability:report`. Do not move or replace that data during deployment.
