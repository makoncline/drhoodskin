import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import app from '../config/app.json' with { type: 'json' }
const infra = { slug: app.slug, ...app.production }
if (!process.env.CLOUDFLARE_API_TOKEN)
  throw new Error('Use the authorized operations context. Development does not need credentials.')
// This is an administrative CLI view of the public identifiers, not a deploy config.
mkdirSync('.local', { recursive: true })
writeFileSync(
  '.local/operations.json',
  JSON.stringify({
    name: infra.slug,
    account_id: infra.accountId,
    d1_databases: [{ binding: 'DB', database_name: infra.slug, database_id: infra.databaseId }],
  }),
)
const result = spawnSync(
  'pnpm',
  ['exec', 'wrangler', ...process.argv.slice(2), '--config', '.local/operations.json'],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
