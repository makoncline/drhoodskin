FROM node:22.23.4-alpine AS base
RUN apk add --no-cache --upgrade 'ca-certificates-bundle>=20261020-r0'

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app

COPY . .
RUN npm run build

FROM base AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/.output ./.output
COPY --from=build /app/scripts/activity-report.ts ./scripts/activity-report.ts
COPY --from=build /app/src/server/activityReport.ts ./src/server/activityReport.ts
COPY --from=build /app/src/server/activityLog.ts ./src/server/activityLog.ts

RUN --mount=type=bind,source=scripts/node-runtime-check.mjs,target=/tmp/node-runtime-check.mjs \
    node --test /tmp/node-runtime-check.mjs

RUN --mount=type=bind,source=scripts/site-runtime-check.mjs,target=/tmp/site-runtime-check.mjs \
    node --test /tmp/site-runtime-check.mjs

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
