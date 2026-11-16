import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import app from '../config/app.json' with { type: 'json' }
const base = app.production.url
if (!base.startsWith('https://')) throw new Error('Set the production HTTPS URL first.')
const checks = []
async function check(path, init, status = 200) {
  const response = await fetch(base.replace(/\/$/, '') + path, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  })
  assert.equal(response.status, status, path)
  assert.ok(response.headers.get('x-correlation-id'), path)
  if (process.env.EXPECTED_REVISION)
    assert.equal(response.headers.get('x-release'), process.env.EXPECTED_REVISION, path)
  checks.push({ path, status: response.status })
  return response
}
await check('/')
await check('/book')
const md = await check('/', { headers: { accept: 'text/markdown' } })
assert.match(md.headers.get('content-type'), /text\/markdown/)
for (const path of [
  '/api/status',
  '/llms.txt',
  '/sitemap.xml',
  '/robots.txt',
  '/openapi.json',
  '/.well-known/mcp/server-card.json',
])
  await check(path)
const deadline = Date.now() + 180_000
let appointments
for (;;) {
  appointments = await fetch(base.replace(/\/$/, '') + '/api/appointments', {
    signal: AbortSignal.timeout(15_000),
  })
  if (appointments.status !== 502 || Date.now() >= deadline) break
  await appointments.body?.cancel()
  await setTimeout(10_000)
}
assert.equal(
  appointments.status,
  200,
  'Wait for the two initial cron refreshes, then inspect NextPatient egress if availability still fails.',
)
const times = await appointments.json()
assert.ok(times.checkedAt)
assert.equal(times.timeZone, 'America/Denver')
checks.push({ path: '/api/appointments', status: appointments.status, checkedAt: times.checkedAt })
const rpc = (method, params) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
})
const tools = await check('/mcp', rpc('tools/list'))
assert.ok((await tools.json()).result.tools.some((tool) => tool.name === 'find_appointments'))
const appointmentTool = await check(
  '/mcp',
  rpc('tools/call', { name: 'find_appointments', arguments: { limit: 1 } }),
)
assert.ok((await appointmentTool.json()).result.structuredContent?.checkedAt)
await check('/mcp', rpc('tools/call', { name: 'unknown_tool' }), 400)
await check('/mcp', rpc('unknown_method'), 400)
await check('/api/appointments?visit=unknown', undefined, 400)
await check('/dev/scheduler', undefined, 404)
mkdirSync('test-results', { recursive: true })
writeFileSync(
  'test-results/live-check.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2),
)
for (const result of checks) console.log(`OK ${result.path} ${result.status}`)
