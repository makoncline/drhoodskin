import { watch, readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { refuseCredentials } from '../no-credentials.js'
refuseCredentials()
const watched = ['src', 'config', 'public', 'scripts/dev', 'vite.config.ts', 'server.ts']
let child,
  building,
  busy = false,
  again = false,
  timer,
  port,
  stopping = false
async function stopProcess(current) {
  if (!current?.pid || current.exitCode !== null || current.signalCode !== null) return
  await new Promise((resolve) => {
    const timer = setTimeout(() => current.kill('SIGKILL'), 10_000)
    current.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    current.kill('SIGTERM')
  })
}
async function stopChild() {
  const current = child
  child = null
  await stopProcess(current)
}
async function rebuild() {
  if (stopping) return
  if (busy) {
    again = true
    return
  }
  busy = true
  if (!port && existsSync('.local/ready.json'))
    port = new URL(JSON.parse(readFileSync('.local/ready.json', 'utf8')).app).port
  await stopChild()
  const code = await new Promise((resolve) => {
    building = spawn('pnpm', ['build'], { stdio: 'inherit' })
    building.once('error', () => resolve(1))
    building.once('exit', resolve)
  })
  building = null
  if (code === 0 && !stopping) {
    child = spawn(process.execPath, ['scripts/dev/start.js'], {
      stdio: 'inherit',
      env: { ...process.env, ...(port ? { APP_DEV_PORT: port } : {}) },
    })
  }
  busy = false
  if (again) {
    again = false
    void rebuild()
  }
}
for (const path of watched)
  watch(path, { recursive: true }, (_, file) => {
    if (file?.includes('routeTree.gen')) return
    clearTimeout(timer)
    timer = setTimeout(() => void rebuild(), 200)
  })
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    stopping = true
    clearTimeout(timer)
    await stopProcess(building)
    await stopChild()
    process.exit(0)
  })
console.log('Watching source files. Reload the browser after the rebuild. Local data is retained.')
void rebuild()
