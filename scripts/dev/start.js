import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { startRuntime } from './runtime.js'
import { refuseCredentials } from '../no-credentials.js'

refuseCredentials()
await mkdir('.local', { recursive: true })
if (existsSync('.local/ready.json')) {
  const { pid } = JSON.parse(readFileSync('.local/ready.json', 'utf8'))
  let running = false
  try {
    process.kill(pid, 0)
    running = true
  } catch {}
  if (running) throw new Error('A local dev server is already running.')
}
let runtime,
  stopRequested = false,
  stopped = false
async function stop() {
  stopRequested = true
  if (!runtime || stopped) return
  stopped = true
  await runtime.close()
  if (
    existsSync('.local/ready.json') &&
    JSON.parse(readFileSync('.local/ready.json', 'utf8')).pid === process.pid
  )
    await rm('.local/ready.json', { force: true })
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
runtime = await startRuntime({
  persist: '.local/dev-logs',
  port: Number(process.env.APP_DEV_PORT || 0),
  onLog: (log) => appendFileSync('.local/requests.jsonl', JSON.stringify(log) + '\n'),
})
if (stopRequested) await stop()
const state = {
  app: runtime.origin,
  logs: '.local/requests.jsonl',
  activity: runtime.logDir,
  pid: process.pid,
}
try {
  await writeFile('.local/ready.json', JSON.stringify(state, null, 2))
  console.log(JSON.stringify(state, null, 2))
} catch (error) {
  await runtime.close()
  throw error
}
