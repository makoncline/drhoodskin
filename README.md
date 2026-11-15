# Dr. Hood Skin

Dr. Channing Hood's physician site and read-only appointment finder. Booking is completed on the official U.S. Dermatology Partners scheduler, not on this site.

## Local development

Use Node 24 (`.nvmrc`) and pnpm 10.29.2. Run all commands from the repository root.

```sh
corepack enable
corepack prepare pnpm@10.29.2 --activate
pnpm install --frozen-lockfile
pnpm browser:install
pnpm dev
```

Read `.local/ready.json` for the local URL. This runs the built Worker in Miniflare with persistent local D1. It uses a NextPatient fixture and cannot fetch external scheduler or booking pages. Source changes rebuild and restart the Worker; reload after the ready message. There is no Vite HMR.

```sh
pnpm check
pnpm launch:check
```

`pnpm check` builds the Worker, tests the real Worker and D1, takes desktop and mobile screenshots, and checks types. Open the screenshots in `test-results/e2e`. The launch check reports missing public account setup. It does not load credentials or create resources.

## Layout

- `src/routes`, `src/components`, `src/styles.css`: the existing UI.
- `src/worker.ts`, `src/server/http.ts`: Worker entry, agent surfaces, API, MCP, and events.
- `src/server/availabilityCache.ts`: D1-only request reads and one-visit cron refreshes.
- `src/lib/nextPatientSchedule.ts`: shared Worker/Node scheduler parser.
- `db/schema.ts`, `db/migrations`: Drizzle schema and reviewed D1 migrations.
- `app/scripts`: the existing Mac poller and its report. Its local SQLite data remains in `app/.data`.
- `config/app.json`: public infrastructure settings. Production fields are empty until account setup.

Read [DEVELOPMENT.md](DEVELOPMENT.md), [OPERATIONS.md](OPERATIONS.md), [PRODUCT.md](PRODUCT.md), and [the migration plan](docs/cloudflare-migration.md).

## Reports

```sh
pnpm activity:report --days=7
pnpm activity:export .local/activity-export.json
pnpm activity:report --file=.local/activity-export.json --days=7 --json
pnpm availability:report
```

The first command reads local D1. The export command writes a new JSON file and refuses to overwrite a file. See [activity logs](docs/activity-logs.md) for the fields and production export procedure.

The Mac poller's scheduled command stays at `app/scripts/poll-availability.ts`. `pnpm availability:poll` forces a real read-only NextPatient poll. It is not part of local checks. Never fetch an `appt-book` link.
