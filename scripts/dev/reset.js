import { rmSync, readFileSync, existsSync } from 'node:fs'
if (existsSync('.local/ready.json')) {
  const { pid } = JSON.parse(readFileSync('.local/ready.json', 'utf8'))
  let running = false
  try {
    process.kill(pid, 0)
    running = true
  } catch {}
  if (running) throw new Error('Stop pnpm dev before resetting local data.')
}
rmSync('.local/wrangler-d1', { recursive: true, force: true })
rmSync('.local/ready.json', { force: true })
console.log('Local fixture database removed.')
