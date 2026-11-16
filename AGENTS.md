# Agent instructions

## Runtime and validation

- Read PRODUCT.md, DEVELOPMENT.md, and OPERATIONS.md before changing the app. Cloudflare migration notes are historical, not the active runtime contract.
- Keep the root-layout UI, portable parser, Request/Response API logic, activity calculations, and useful fixture-driven tests. Do not add an unused second hosting adapter.
- Use patched Node 24 (at least 24.22.3) and pnpm 10.29.2 from the repository root.
- Use `pnpm dev` for the built Node server with synthetic NextPatient responses. Read `.local/ready.json` for the URL and activity directory. Reload after a rebuild.
- Run `pnpm check` and review all four home/book desktop/mobile screenshots. Report commands, results, artifact paths, and tested SHA.
- Exercise the real Node server and JSONL persistence. Replace only NextPatient at the outbound fetch boundary; block unexpected requests. Never fetch an `appt-book` link.
- Keep single-flight availability refresh, the two-minute freshness policy, six-hour stale ceiling, manual-refresh floor, and per-visit failure backoff. API and SSR bundles must use the same process cache.
- Keep PRODUCT.md content rules and the existing UI. No payments, authentication, or email features are part of this work.
- Activity logs contain no raw IPs or user agents. Persist the daily visitor salt privately so restarts do not split same-day visitor counts. Retention applies only to approved activity/salt filenames and skips unrelated files, directories, invalid dates, and symlinks.
- The Mac poller and its data stay at `app/scripts/poll-availability.ts` and `app/.data`. `pnpm availability:poll` performs real requests and is not a fixture check.

## Deployment

- Production stays on makon-dev-0. Never run builds, install dependencies, or use Compose build operations on that VPS.
- Build and test the private GHCR image in GitHub Actions. PRs do not publish or deploy. Production releases use the protected main-only environment and the existing deploy webhook.
- Preserve `./data:/app/data`, the `edge` network alias, port 3000, log rotation, and the 256 MiB memory/swap limits.
- Docker context must exclude credentials, `.docker`, `.env` files, `.local`, logs, SQLite files, and Mac `.data`. Never print tokens or put them in source.
- Inspect the installed server deployment script before relying on rollback; it can differ from the bootstrap repository. Preserve the old image and Compose before the first image-based rollout.
- Keep resource and merge approval boundaries. Do not change DNS, Caddy, the tunnel, other apps, or billing as part of an image release.

## Local history

Search [logs.md](logs.md) for relevant prior work and verify old observations. Append new dated notes there.
