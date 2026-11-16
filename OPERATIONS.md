# Operations

## Current hosting decision

Production stays on makon-dev-0 at `/srv/stacks/drhoodskin`. The live domain never moved to the experimental Worker. Do not change DNS, Caddy, or the tunnel for this repair. No paid Cloudflare plan is authorized.

Build images in GitHub Actions, not on this 2 GB VPS. On-server builds previously caused other production apps to be OOM-killed. The VPS must only pull and run prebuilt images.

## Runtime contract

- Image: `ghcr.io/makoncline/drhoodskin:<full commit SHA>`, private.
- Node: patched 24, pinned to 24.22.3 in Docker and CI; pnpm 10.29.2.
- Entry: `node .output/server/index.mjs`.
- Internal host/port: `0.0.0.0:3000`, on the existing `edge` network with alias `drhoodskin`.
- Volume: `./data:/app/data`; `LOG_DIR=/app/data/logs`. Never remove this volume.
- Memory and swap ceilings: 256 MiB each. Docker stdout logs rotate at 10 MB across three files.
- Responses include `X-Correlation-ID` and `X-Release`. The release header is the build revision, not proof of an image digest; inspect the running image for that.

The app shares one availability cache between Nitro's API and SSR bundles. It uses two-minute freshness, single-flight refresh, a six-hour stale ceiling, a sixty-second manual-refresh floor, and per-visit exponential retry backoff capped at fifteen minutes. Refresh does not depend on an external cron or database service. Expired appointment starts are filtered before they are offered.

## Private registry authentication

The owner-approved pull-only GitHub token is stored in an app-specific Docker configuration at `/srv/stacks/drhoodskin/.docker`, with directory mode 0700. The credential source is in the owner's 1Password; keep its item identifier and token out of this public repository.

Set `DOCKER_CONFIG=/srv/stacks/drhoodskin/.docker` for this app's pulls and in `/etc/bootstrap/deploy-hooks/drhoodskin.env`. Do not change another app's Docker credentials. Registry credentials, `.env` files, Mac `.data`, SQLite files, logs, and local artifacts must never enter the build context or GHA cache.

A new GHCR package is private by default. After publication, CI tries to read the image with no credentials; if that succeeds, the image is public and the job fails before deploy. Do not change the repository's visibility or make the package public.

## Image pipeline

`.github/workflows/deploy.yml` runs verification before the image job. PRs build and test an unpushed image without registry login or production secrets. Main releases publish the exact tested image once per commit-SHA tag through `GITHUB_TOKEN`. Reruns pull, test, and reuse an already published image instead of replacing the tag. Publication checks again for a tag created during the build and refuses to overwrite it. Third-party Actions and the Node base image are pinned by commit SHA/digest. Record the published digest.

The image runs public-boundary smoke checks under the same 256 MiB limit used in production, including dense fixtures for both visit types, REST loading, and server-rendered booking links sharing the API cache. The Docker build also checks the Node runtime and built server. These checks do not contact NextPatient or open booking links.

The protected deployment job runs only on current `main`, in the GitHub `production` environment. It sends `DEPLOY_WEBHOOK_TOKEN` only to `https://deploy.makon.dev/deploy/drhoodskin`. It skips superseded releases, waits for image verification, serializes deployments without cancelling one in flight, and then checks live patient/agent boundaries and the expected `X-Release` header.

## First image-based rollout

1. Inspect the installed `/usr/local/bin/bootstrap-compose-deploy.sh` and current stack before changes. The installed script differs from the bootstrap repository: it pulls during rollback and its update command does not explicitly pass `--no-build`.
2. Preserve the current image ID and original Compose/environment files. The original image at preflight was `sha256:ff06f875eab779bbf7b6d4a0834928bdd8350540156d137883742ff42312f91e`, running source `5f2516241713f1d6ce3e3ed2a87abe876b8c8ec2`; verify these before use. Keep the uncommitted server `logs.md` changes.
3. Wait for a verified, privately published image. Use the app-specific registry login to pull it. Stage only reviewed Compose/environment files; do not pull the Worker source tree into this live stack or install dependencies there.
4. Apply the image-only Compose with `docker compose up -d --no-build --pull never`. If it fails checks, restore the original Compose/environment and start the preserved local image with the same no-build/no-pull flags. Do not depend on an unpublished registry tag for the first rollback.
5. Verify the running image/digest, memory limit, retained data mount, release header, both appointment types, browser flow, REST/MCP, and activity/report persistence.
6. Only after this successful baseline, register the `drhoodskin` webhook target with the new published SHA already in `.env`. Use a separate empty deploy-cache directory, never the log/data directory. Disable image pruning during this first rollout. Re-run the approved deployment job to prove the unattended repeat release.

Registering the target only after the image-only baseline prevents the webhook from seeing the old build-based Compose. The first main image publication can precede target setup; do not treat a missing target as permission to build on the VPS.

**Completed 2026-11-16.** Commit `1d9323a` runs as `ghcr.io/makoncline/drhoodskin@sha256:f7ae194480d42a515d9e84d773ddfb0dc0d2a7ca5767c725994f73c519111a78` with the 256 MiB limit and the original `./data` mount. The pre-switch Compose file is in `/srv/stacks/drhoodskin-rollback-20261116T043848Z/`, and the old image is tagged `drhoodskin-rollback:5f25162`. To return to it, restore that `compose.yaml`, remove `.env`, and run `docker compose up -d --no-build --pull never`.

The webhook target `/etc/bootstrap/deploy-hooks/drhoodskin.env` sets `DOCKER_CONFIG` to the app's private registry login, a separate `deploy-cache/` directory, automatic rollback, and no image pruning. Its smoke URL is `https://drhoodskin.com/api/status`.

`/srv/stacks/drhoodskin` is still a Git checkout of the old source, with `compose.yaml` intentionally changed and `.env` added. Never run `git pull` or any build there. Deliver Compose changes by copying the reviewed file from `main`.

The first published package inherited **public** visibility from the public repository, although new packages are documented as private. The CI anonymous-read check caught it and blocked the deploy. Makon's chosen visibility was then set to private in the package settings; an anonymous manifest request now returns 403.

## Normal release and rollback

After bootstrap, a tested main release publishes its image, calls the existing webhook, and runs the live checks. The server should never need application source or dependencies for an image release. Compose changes remain a separate reviewed configuration update; a new image tag does not synchronize Compose automatically.

For rollback, select a previous known-good published SHA and use the existing server deployment command for the `drhoodskin` target. Confirm the private registry credential works, the earlier image is available, and the log volume remains mounted. Do not use an old workflow rerun to bypass the current-main guard. Retain the first local image/configuration backup until repeat deployment and rollback are verified.

## Cloudflare experiment

Keep `docs/cloudflare-migration.md` and useful Git history. Do not import Worker test traffic into real VPS activity logs. On 2026-11-16, with Makon's approval, the abandoned `drhoodskin` Worker's cron trigger and workers.dev URL were turned off, the Cloudflare secrets were removed from this repository's `production` environment, and the dedicated "drhoodskin deploy (GitHub Actions)" API token was deleted. Makon then approved deleting the idle Worker script and the D1 database `drhoodskin` (test data only); both were deleted the same day. No Cloudflare resources remain for this site. Restarting a Cloudflare port means creating new ones. Do not alter other Workers or enable billing.
