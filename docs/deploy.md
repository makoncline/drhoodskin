# Deploy

Production runs on makon-dev-0 in `/srv/stacks/drhoodskin`. Do not build images on that server. It has 2 GB of memory, and a build can cause the kernel to stop other production apps.

## How a deploy works

1. A push to `main` starts `.github/workflows/verify.yml`.
2. The `image` job builds `app/Dockerfile` and pushes `ghcr.io/makoncline/drhoodskin:<commit SHA>`. Pull requests build the image but do not push it.
3. After the tests and the image job pass, the `deploy` job sends the SHA to the server deploy webhook (`https://deploy.makon.dev/deploy/drhoodskin`, `DEPLOY_WEBHOOK_TOKEN` secret).
4. The server sets `IMAGE_TAG` in `/srv/stacks/drhoodskin/.env`, pulls the image, and runs `docker compose up -d --no-build`. It checks `https://drhoodskin.com/`. If the check fails, it starts the previous image again. It keeps the two newest images.

## Runtime

- Internal port: 3000, on the external Docker network `edge` with the alias `drhoodskin`.
- Environment: `PORT` and `LOG_DIR` are set in `compose.yaml`. The server `.env` holds only `IMAGE_TAG`. There are no secrets.
- Volume: `./data` mounts at `/app/data`. It holds the activity logs and must persist.
- Memory limit: 256 MiB. The app uses about 60 MiB.

## Change compose.yaml

The deploy webhook changes only `IMAGE_TAG`. To apply a change to `compose.yaml`, go to `/srv/stacks/drhoodskin` on the server and run:

```sh
git pull --ff-only
docker compose up -d
```

## Roll back

Deploy an earlier image. From the `servers` repository:

```sh
./bootstrap/local/test-deploy-webhook.sh bootstrap/hosts/.env.production drhoodskin <earlier commit SHA>
```

You can also re-run the `deploy` job of an earlier workflow run on `main`.
