import { watch, readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { refuseCredentials } from '../no-credentials.js'
refuseCredentials()
const watched = ['src', 'config', 'db', 'public', 'scripts/dev', 'vite.config.ts', 'alchemy.run.ts']
let child,
  busy = false,
  again = false,
  timer,
  port,
  stopping = false
async function stopChild() {
  if (!child) return
  const current = child
  child = null
  if (current.exitCode !== null || current.signalCode !== null) return
  await new Promise((resolve) => {
    current.once('exit', resolve)
    current.kill('SIGTERM')
  })
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
    const build = spawn('pnpm', ['build'], { stdio: 'inherit' })
    build.once('exit', resolve)
  })
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
    if (file?.includes('routeTree.gen') || file?.includes('worker-configuration')) return
    clearTimeout(timer)
    timer = setTimeout(() => void rebuild(), 200)
  })
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    stopping = true
    clearTimeout(timer)
    await stopChild()
    process.exit(0)
  })
console.log('Watching source files. Reload the browser after the rebuild. Local data is retained.')
void rebuild()
