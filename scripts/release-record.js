import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import app from '../config/app.json' with { type: 'json' }
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${app.production.accountId}/workers/scripts/${app.slug}/deployments`,
  { headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } },
)
if (!response.ok)
  throw new Error('Release deployed; could not read its version. Inspect deployment.log.')
const { result: data } = await response.json()
mkdirSync('test-results', { recursive: true })
writeFileSync(
  'test-results/release.json',
  JSON.stringify(
    {
      revision: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      deployment: data.deployments[0].id,
      versions: data.deployments[0].versions,
      migrations: readdirSync('db/migrations').filter((f) => /^\d{14}_/.test(f)),
      recovery:
        'Pre-migration D1 bookmark is in deployment.log; it expires with Time Travel retention.',
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
)
