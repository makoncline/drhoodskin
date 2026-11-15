import { spawnSync, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import app from '../config/app.json' with { type: 'json' }
const infra = { slug: app.slug, ...app.production }
if (!process.env.CLOUDFLARE_API_TOKEN || process.env.GITHUB_REF !== 'refs/heads/main')
  throw new Error('Deploy only in the protected main GitHub job.')
const run = (args) => {
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: infra.accountId,
      ALCHEMY_HOME: `${process.cwd()}/.local/alchemy-auth`,
    },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
if (spawnSync(process.execPath, ['scripts/launch-check.js'], { stdio: 'inherit' }).status !== 0)
  process.exit(1)

const base = `https://api.cloudflare.com/client/v4/accounts/${infra.accountId}`
async function get(path) {
  const response = await fetch(base + path, {
    headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
  })
  if (!response.ok)
    throw new Error(`Cloudflare preflight failed (${response.status}). No deployment started.`)
  const body = await response.json()
  if (!body.success) throw new Error('Cloudflare preflight failed. No deployment started.')
  return body.result
}
// Adoption by name must resolve to the configured database, never a new empty DB.
const database = await get(`/d1/database/${infra.databaseId}`)
if (database.uuid !== infra.databaseId || database.name !== infra.slug)
  throw new Error('Database identity mismatch. No deployment started.')
const bookmark = await get(`/d1/database/${infra.databaseId}/time_travel/bookmark`)
if (!bookmark.bookmark) throw new Error('No recovery bookmark. No deployment started.')
mkdirSync('test-results', { recursive: true })
writeFileSync(
  'test-results/pre-deploy.json',
  JSON.stringify(
    {
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      databaseId: infra.databaseId,
      bookmark: bookmark.bookmark,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
)
console.log(`Pre-deploy D1 bookmark: ${bookmark.bookmark}`)
run([
  'exec',
  'alchemy',
  'state',
  'bootstrap',
  '--backend',
  'cloudflare',
  '--name',
  `${infra.slug}-state`,
  '--no-input',
])
run(['exec', 'alchemy', 'deploy', '--stage', 'prod', '--yes', '--no-input'])
