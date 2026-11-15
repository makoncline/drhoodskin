# Operations

Phase 1 is local only. Do not deploy or load credentials as part of development. The existing Node container remains the production site until the migration cutover. Follow [the migration plan](docs/cloudflare-migration.md) for phases 2–6.

The release method follows startup-template at `ad001e7` and the tested Alchemy/D1 release path in Home Cook Hotline. This site's NextPatient egress, cron CPU use, first deploy, and repeat deploy still need production checks.

## Account setup (phase 2)

Makon must approve each account resource before it is created or changed.

1. Keep Workers and D1 on Free, with paid overages disabled. Check the shared account's Cron Trigger quota. This site uses one trigger.
2. Create D1 database `drhoodskin`. Set `production.accountId` and `production.databaseId` in `config/app.json`.
3. Set `production.url` to the intended HTTPS workers.dev URL for phase 3. Alchemy does not attach a custom domain for a workers.dev URL. Set the public domain only for the approved phase-4 cutover.
4. Create a drhoodskin Production 1Password Environment containing `CLOUDFLARE_API_TOKEN`. The token needs the D1, Worker, account, and Secrets Store access used by Alchemy's state backend. No application secrets, payment service, auth service, or email provider are used.
5. Set the public 1Password Environment ID in `production.onePasswordEnvironmentId`. Store the bootstrap token only as `OP_TOKEN` in the GitHub `production` environment. Protect that environment for `main` only and set the Actions spending limit to $0.
6. Run `pnpm launch:check`. Then run `node scripts/prepare-ops.js`. This writes the Varlock contract, not secret values. Do not load those values during local checks.

Production fields are intentionally empty in phase 1. A failed launch check for URL, account, database, and 1Password is expected. No production resources are created by that command.

## Protected release (phase 3 onward)

Run `pnpm check` and inspect the four screenshots before an authorized release. Use the manual **Deploy production** workflow on `main`. It uses the pinned Playwright image, marks exactly `$GITHUB_WORKSPACE` as a Git safe directory, installs pinned pnpm dependencies, and tests before it loads `OP_TOKEN`.

The protected deployment script:

- Refuses to run without a Cloudflare token and `GITHUB_REF=refs/heads/main`.
- Runs the launch check.
- Verifies the configured D1 UUID and the exact name `drhoodskin` before adoption.
- Saves a D1 Time Travel bookmark before migrations.
- Bootstraps or adopts `drhoodskin-state`, then deploys only the Alchemy `prod` stage.

Alchemy declares the D1 binding, SQL migrations, Worker, one-minute cron, version metadata, and observability. All declared app resources use adopt and retain policies. Workers.dev is enabled; version-preview URLs and hosted preview stages are disabled. Do not delete a database or state store to fix an adoption error.

After deployment, the job records the Git SHA, active deployment/version IDs, and migration names, then runs the live HTTP check. The check does not open `appt-book` links. A new D1 starts empty; the live check waits up to three minutes for the initial cron refreshes. If it still fails, inspect cron delivery and NextPatient egress before retrying. An empty scheduler cache is an error, not proof of no available appointments.

Release artifacts contain `deployment.log`, `test-results/pre-deploy.json`, `release.json`, `live-check.json`, screenshots, and local check logs. They do not include `.alchemy`, `.local`, profile caches, or secret files. Run the protected job a second time against the same commit and confirm a repeat release before relying on this site's release path.

## Availability and Free limits

Requests never contact NextPatient. `/book`, REST, and MCP read D1 and discard expired slots. A cached snapshot is usable for less than six hours. `/book` Refresh only re-reads D1.

One cron invocation claims one due visit row atomically. Each successful visit is due after four minutes from 06:00 to 22:00 America/Denver, or thirty minutes overnight. A failed attempt keeps the previous snapshot and persists its error. Retry delay starts at one minute, doubles, and stops at fifteen minutes. Success clears the error and resets backoff. A three-minute claim lease prevents overlapping invocations from selecting the same visit while its fetches are in progress.

The parser scans the observed 92-day booking horizon. It fetches each three-day window at most once, uses no more than 31 external requests, and starts at most six at a time. It does not follow redirects. It fetches only read-only scheduler data, never booking links. Markup drift remains an error.

Workers Free has a 10 ms CPU budget, 50 external subrequests, six concurrent outbound connections, 50 D1 queries per invocation, and shared daily request quotas. Local tests enforce the fetch-count and concurrency bounds, not production CPU time. Measure SSR and the largest cron pass in phase 3. The plan permits static prerendering of `/` only if measured SSR CPU regularly exceeds the limit. Do not enable a paid plan as a fix.

## Activity and diagnosis

Activity is stored in D1 with the same report fields as the old JSONL rows. Each Denver day has one shared random visitor salt. A daily scheduled pass removes expired activity and earlier salts. See [activity logs and reports](docs/activity-logs.md).

Request diagnostics return `X-Correlation-ID` and log service, release, normalized route, method, status, and elapsed wall time. They do not log query strings, request bodies, IPs, or raw user agents. Native Cloudflare platform logs can contain request metadata; inspect exports before sharing. Observability uses Free quotas and finite retention. It is not the 180-day activity store.

Create an error monitor in the authorized account setup: count this Worker's error-level events each minute, alert at one or more, and limit repeats to once per hour. Verify notification delivery and the real log-to-alert path. Do not create a paid export or monitor.

## Rollback and recovery

Until phase 5, restore the old tunnel hostname and start the installed server container to roll back the cutover. Do not rebuild on the small server as part of phase 1. Keep its data intact.

For a code-only Worker failure, use `pnpm ops rollback` in an authorized operations context. Review schema compatibility first. Code rollback does not restore D1.

D1 Time Travel on Free retains seven days. A restore discards later writes and requires explicit approval for the loss. Save a current bookmark/export, stop writes, inspect the target bookmark, restore, verify the public pages and cached availability, and save the undo bookmark. Use forward SQL migrations for routine changes. Do not restore production as a drill.

Alchemy stores encrypted state in the app-specific state Worker and SQLite Durable Object, with its generated key/token in Cloudflare Secrets Store. Retain that state across releases. A missing state store is not permission to delete or recreate D1.
