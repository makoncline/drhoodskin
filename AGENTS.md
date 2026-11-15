# Agent instructions

## Runtime and validation

- Read PRODUCT.md, DEVELOPMENT.md, OPERATIONS.md, and docs/cloudflare-migration.md before changing the app.
- Use Node 24 and pnpm 10.29.2. Run commands from the repository root.
- Use `pnpm dev` for the built Worker in Miniflare. Read `.local/ready.json` for the URL. Reload after a rebuild. Use `pnpm dev:reset` only after stopping it.
- Run `pnpm check` and open all four home/book desktop/mobile screenshots in `test-results/e2e`. Report commands, results, artifact paths, and the tested SHA.
- Exercise the real Worker and D1. Replace only NextPatient at the outbound fetch boundary. Block unexpected network traffic. Never fetch an `appt-book` link.
- Request paths read D1 only. The cron handler refreshes one due visit type per invocation. Keep the Free-plan request, concurrency, D1-query, and CPU budgets.
- Keep the existing UI and PRODUCT.md content rules. Do not copy the template's payments, auth, or email product code.
- Edit `db/schema.ts`, generate and review SQL, then commit migrations. Do not edit an applied migration.
- Use `pnpm activity:report --days=7` for local D1. Use `pnpm activity:export <new-json-path>` and `pnpm activity:report --file=<json-path> --days=7` for exports.
- The Mac poller remains at `app/scripts/poll-availability.ts` and uses `app/.data`. `pnpm availability:report` reads its history. `pnpm availability:poll` makes real read-only requests; do not run it as a local fixture check.
- No local task needs production credentials. Deployment needs a separate explicit request and the protected manual main workflow. Do not create account resources or enable paid features without approval.
- Append template gaps to the Template findings section in docs/cloudflare-migration.md. Do not edit the template repository during this port.

## Local history

Dated notes are in [logs.md](logs.md). Search it when prior work is relevant to the task. Verify old observations before using them as current facts. Append new dated notes there.
