FROM node:22.23.4-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app

COPY . .
RUN npm run build

FROM node:22.23.4-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/.output ./.output

RUN --mount=type=bind,source=scripts/node-runtime-check.mjs,target=/tmp/node-runtime-check.mjs \
    node --test /tmp/node-runtime-check.mjs

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
