import * as Alchemy from 'alchemy'
import * as Cloudflare from '@alchemy.run/cloudflare'
import { adopt } from 'alchemy/AdoptPolicy'
import { retain } from 'alchemy/RemovalPolicy'
import { Effect } from 'effect'
import app from './config/app.json'
const infra = { slug: app.slug, ...app.production }

// The protected release verifies D1 identity before these resources are adopted.
export const Website = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack
  if (stack.stage !== 'prod')
    throw new Error(
      'Use pnpm dev for secret-free local development. Only the prod stage is supported.',
    )
  const database = yield* Cloudflare.D1.Database('Database', {
    name: infra.slug,
    migrations: './db/migrations',
  }).pipe(adopt(true), retain(true))
  const site = yield* Cloudflare.Website.Vite('Website', {
    main: './src/worker.ts',
    name: infra.slug,
    ...(infra.url && !new URL(infra.url).hostname.endsWith('.workers.dev')
      ? { domain: new URL(infra.url).hostname }
      : {}),
    compatibility: { date: '2026-11-03', flags: ['nodejs_compat'] },
    workersDev: { enabled: true, previewsEnabled: false },
    crons: ['* * * * *'],
    env: {
      DB: database,
      CF_VERSION_METADATA: Cloudflare.Workers.VersionMetadata(),
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
      traces: { enabled: true, headSamplingRate: 1 },
      redactQueryString: true,
    },
  }).pipe(adopt(true), retain(true))
  return site
})

export default Alchemy.Stack(
  infra.slug,
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state({
      accountId: infra.accountId || undefined,
      workerName: `${infra.slug}-state`,
    }),
  },
  Effect.gen(function* () {
    const site = yield* Website
    return { url: site.url }
  }),
)
