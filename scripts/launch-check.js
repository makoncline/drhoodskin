import { readFileSync } from 'node:fs'
import { parse } from 'jsonc-parser'
import app from '../config/app.json' with { type: 'json' }
const config = parse(readFileSync('wrangler.jsonc', 'utf8'))
const database = config.d1_databases?.find((binding) => binding.binding === 'DB')
const checks = {
  identity: app.slug === 'drhoodskin' && config.name === app.slug,
  url: /^https:\/\/drhoodskin\.[a-z0-9-]+\.workers\.dev$/.test(app.production.url),
  database:
    database?.database_name === app.slug &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(database.database_id) &&
    !/^0{8}-/.test(database.database_id),
  workersDev: config.workers_dev === true,
  noCustomRoutes: !config.route && !config.routes?.length,
  cron: config.triggers?.crons?.length === 1,
}
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'OK' : 'MISSING'} ${name}`)
console.log(
  'Account checks still required before release: Free plan limits, cron quota, main-only GitHub production environment, CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, and the Actions spending limit. No resources were changed and no secret values were read.',
)
if (Object.values(checks).some((ok) => !ok)) process.exitCode = 1
