# Dr. Hood Skin

Dr. Channing Hood's physician site and read-only appointment finder. Patients complete booking on the official U.S. Dermatology Partners scheduler, not on this site.

## Runtime

The site runs on the existing VPS as a Node 24/Nitro container. GitHub Actions builds and verifies the private image at `ghcr.io/makoncline/drhoodskin`. The VPS must only pull and run images; never build there. See [OPERATIONS.md](OPERATIONS.md) for release setup and rollback.

The root-layout React UI, scheduler parser, API/MCP contracts, report logic, and fixture-driven tests remain portable. The Cloudflare experiment is recorded in [docs/cloudflare-migration.md](docs/cloudflare-migration.md); it is not the active deployment method. No new hosting subscription is required.

## Local development

Use Node 24.22.3 or a later patched Node 24, and pnpm 10.29.2. Run commands from this repository root.

```sh
corepack enable
corepack prepare pnpm@10.29.2 --activate
pnpm install --frozen-lockfile
pnpm browser:install
pnpm dev
```

Read `.local/ready.json` for the URL and activity directory. This runs the built Node server with synthetic NextPatient responses. Unexpected outbound calls are blocked. Source changes rebuild and restart the server on the same port; reload after the ready message.

```sh
pnpm check
```

The check runs lint, a production build, helper tests, real-server end-to-end workflows, and TypeScript. Review the home/book desktop/mobile screenshots in `test-results/e2e`.

## Layout

- `src/routes`, `src/components`, `src/styles.css`: patient UI.
- `server.ts`: thin Node/Nitro request entry and response headers.
- `src/server/http.ts`: standard Request/Response handling for agent files, REST, MCP, and events.
- `src/server/availabilityCache.ts`: process-wide single-flight refresh, stale fallback, and backoff.
- `src/lib/nextPatientSchedule.ts`: DOM-free parser shared by the website and Mac poller.
- `src/lib/activity.ts`, `src/server/activityReport.ts`: portable activity fields and report calculations.
- `src/server/activityLog.ts`: Node JSONL persistence and approved retention.
- `scripts/dev`, `test/e2e`: built-server harness and external-service fixtures.
- `Dockerfile`, `compose.yaml`, `.github/workflows/deploy.yml`: image build and VPS release configuration.

## Reports

```sh
LOG_DIR=.local/dev-logs pnpm activity:report --days=7
LOG_DIR=.local/dev-logs pnpm activity:export .local/activity-export.json
pnpm activity:report --file=.local/activity-export.json --days=7 --json
pnpm availability:report
```

Exports refuse to overwrite existing files and exclude visitor salts. See [docs/activity-logs.md](docs/activity-logs.md).

The Mac poller remains at `app/scripts/poll-availability.ts`, with its SQLite history in `app/.data`. `pnpm availability:poll` makes real read-only NextPatient requests; it is not part of local checks. Never fetch an `appt-book` link in automation.

Read [PRODUCT.md](PRODUCT.md), [DEVELOPMENT.md](DEVELOPMENT.md), and [OPERATIONS.md](OPERATIONS.md) before changes.
