import { appendFileSync } from 'node:fs'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { startRuntime } from './runtime.js'
import { refuseCredentials } from '../no-credentials.js'
refuseCredentials()
await mkdir('.local', { recursive: true })
const runtime = await startRuntime({
  persist: '.local/fixture-d1',
  port: Number(process.env.APP_DEV_PORT || 0),
  onLog: (log) => appendFileSync('.local/requests.jsonl', JSON.stringify(log) + '\n'),
})
await runtime.scheduled()
await runtime.scheduled()
const timer = setInterval(
  () => runtime.scheduled().catch(() => console.error('Local scheduled pass failed')),
  60_000,
)
const state = { app: runtime.origin, logs: '.local/requests.jsonl', pid: process.pid }
await writeFile('.local/ready.json', JSON.stringify(state, null, 2))
console.log(JSON.stringify(state, null, 2))
let stopped = false
async function stop() {
  if (stopped) return
  stopped = true
  clearInterval(timer)
  await runtime.close()
  await rm('.local/ready.json', { force: true })
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
