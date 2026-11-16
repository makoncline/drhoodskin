FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS base
RUN apk add --no-cache --upgrade 'ca-certificates-bundle>=20261020-r0'

FROM base AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM base AS runtime
WORKDIR /app
ARG APP_REVISION=local
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV APP_REVISION=$APP_REVISION
LABEL org.opencontainers.image.source="https://github.com/makoncline/drhoodskin"
LABEL org.opencontainers.image.revision=$APP_REVISION
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.output ./.output
COPY --from=build /app/scripts/activity-report.ts ./scripts/activity-report.ts
COPY --from=build /app/scripts/activity-export.js ./scripts/activity-export.js
COPY --from=build /app/src/server/activityReport.ts ./src/server/activityReport.ts
COPY --from=build /app/src/lib/activity.ts ./src/lib/activity.ts
RUN --mount=type=bind,source=scripts,target=/app/scripts \
    --mount=type=bind,source=src/lib/nextPatientSchedule.ts,target=/app/src/lib/nextPatientSchedule.ts \
    node --test scripts/node-runtime-check.mjs scripts/site-runtime-check.mjs
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
