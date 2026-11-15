# Operations

Deploy to workers.dev first. Do not change DNS, attach a custom domain, change the tunnel, or stop the existing server until a separate cutover approval. Follow [the migration plan](docs/cloudflare-migration.md).

## Stack and resources

Use the official `@cloudflare/vite-plugin` with TanStack Start and Wrangler. `wrangler.jsonc` declares Worker `drhoodskin`, the D1 `DB` binding, one minute cron, `nodejs_compat`, observability, version metadata, and workers.dev. No routes or custom domains are configured. The build generates the deployment configuration in `dist/server/wrangler.json`.

The approved D1 database is `drhoodskin`, ID `788fd598-812f-4933-8334-a56d9d82d385`, in account `862f016642ad509483b546d81fc48f63`. It was created with the logged-in local Wrangler CLI on 2026-11-15. Its remote schema has not yet been installed. The intended URL is `https://drhoodskin.daylilycatalog.workers.dev`; a URL in config does not mean the Worker is deployed.

The Workers dashboard confirmed the Free plan on 2026-11-15. Existing Workers used one of the five account Cron Triggers before this site's deployment. Do not enable a paid plan, paid overages, or additional services.

## GitHub deployment setup

Use the repository's `production` environment with a custom deployment branch policy allowing `main` only. It needs these environment secrets:

- `CLOUDFLARE_ACCOUNT_ID`: the public account ID above.
- `CLOUDFLARE_API_TOKEN`: a token with Worker script and D1 write access for this account. The coordinator collects and installs it. Never read, print, or copy its value into source, logs, or chat.

Check the Actions spending limit remains $0. Do not broaden the environment's deployment policy to get a branch deployment through.

The implementation agent must stop when the API token is needed. After the coordinator installs it, open the `cf-migration` PR, wait for CI, and stop before merging. The coordinator reviews and merges.

## Release

The **Check and deploy** workflow follows the grunge deployment shape:

1. Pull requests, pushes to `main`, and manual dispatch run `pnpm check` without deployment secrets.
2. Only a non-PR run on `main` enters the protected `production` environment.
3. The job builds with the official Cloudflare adapter.
4. It runs `pnpm exec wrangler d1 migrations apply drhoodskin --remote`.
5. It runs `pnpm exec wrangler deploy`.
6. It runs `node scripts/live-check.js` against the workers.dev URL.

Tests run in the pinned Playwright container. That job marks exactly `$GITHUB_WORKSPACE` as a Git safe directory. Deployment credentials are scoped to the migration and deploy steps, not the build or check steps. CI keeps the local check report, screenshots, logs, and live-check output as artifacts.

The live check never opens an `appt-book` link. A new D1 starts empty; it waits up to three minutes for initial cron-fed availability. New cron configuration can take time to propagate. If the check still fails, inspect cron delivery and NextPatient egress before retrying. Do not add a request-path fetch to fill the cache.

After the first successful deploy, inspect the pages and agent surfaces on workers.dev, verify both visit types refresh, measure CPU, and confirm an unattended repeat deploy. Do not change DNS until those checks pass and cutover is approved.

## Schema and local runtime

Edit `db/schema.ts`, run `pnpm db:generate`, and inspect the generated SQL and snapshot. Wrangler uses `migrations_dir: db/migrations` and `migrations_pattern: db/migrations/*/migration.sql` for the Drizzle directory layout. Do not edit an applied migration.

Local development and E2E run Wrangler's real `d1 migrations apply --local` command before starting the built Worker in Miniflare. They share the same D1 ID and persistence layout. Local data is in `.local/wrangler-d1`; no remote database is used by checks. Earlier phase-1 fixture data is left in `.local/fixture-d1` and is not imported.

## Availability and Free limits

Requests never contact NextPatient. `/book`, REST, and MCP read D1 and discard expired slots. A cached snapshot is usable for less than six hours. `/book` Refresh only re-reads D1.

One cron invocation claims one due visit row atomically. Success is due after four minutes from 06:00 to 22:00 America/Denver, or thirty minutes overnight. Failure keeps the previous snapshot and persists its error. Retry delay starts at one minute, doubles, and stops at fifteen minutes. Success resets backoff. A three-minute claim lease prevents overlapping invocations from selecting the same visit during its fetches.

The parser scans the observed 92-day horizon with at most 31 external reads and six concurrent fetches. It does not follow redirects or open booking links. Markup drift remains an error.

Workers Free has a 10 ms CPU budget, 50 external subrequests, six concurrent outbound connections, 50 D1 queries per invocation, and shared daily request quotas. Local tests enforce fetch counts and concurrency, not production CPU. Measure SSR and the largest cron pass after deployment. The plan permits static prerendering of `/` only if measured SSR CPU regularly exceeds the limit. Do not enable paid features as a fix.

## Activity and diagnosis

Activity is stored in D1 with the old report fields. Denver-day salts and daily retention state are shared across isolates. See [activity logs and reports](docs/activity-logs.md).

Responses return `X-Correlation-ID`. Request diagnostics log service, release, normalized route, method, status, and elapsed wall time, without query strings, raw bodies, IPs, or raw user agents. Native platform logs can contain request metadata; inspect exports before sharing. Free telemetry has finite retention and is not the activity store.

No account error monitor is created by this setup. Any later monitor needs separate resource approval and must use Free features.

## Recovery

Until decommissioning, the old server and tunnel remain installed. An approved cutover rollback can restore the old tunnel hostname and start the installed container. Do not rebuild on the small server as part of this port.

For a Worker code failure, use `pnpm exec wrangler rollback` in an authorized operations context. Check schema compatibility first. Code rollback does not restore D1 data.

D1 Time Travel on Free retains seven days. A restore discards later writes and needs explicit approval for that loss. Save a current bookmark/export, stop writes, inspect the target bookmark, restore, verify the site, and save the undo bookmark. Prefer forward SQL migrations for routine fixes. Never use production for a restore drill.
