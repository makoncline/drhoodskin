import app from '../config/app.json' with { type: 'json' }
const p = app.production
let url = false
try {
  const parsed = new URL(p.url)
  url =
    parsed.protocol === 'https:' &&
    parsed.pathname === '/' &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password
} catch {}
const checks = {
  identity: app.slug === 'drhoodskin',
  url,
  account: /^[a-f0-9]{32}$/.test(p.accountId),
  database: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(p.databaseId),
  onePassword: /^[a-z0-9]{20,40}$/.test(p.onePasswordEnvironmentId),
}
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? 'OK' : 'MISSING'} ${name}`)
console.log(
  'Account checks still required: Workers/D1 Free limits, one available Cron Trigger, API token and Secrets Store scope, protected main-only GitHub production environment, OP_TOKEN, $0 Actions limit, and error monitor. No resources were changed; no credentials were loaded.',
)
if (Object.values(checks).some((ok) => !ok)) process.exitCode = 1
