import { renameSync, readFileSync, existsSync } from 'node:fs'
if (existsSync('.local/ready.json')) {
  const { pid } = JSON.parse(readFileSync('.local/ready.json', 'utf8'))
  let running = false
  try {
    process.kill(pid, 0)
    running = true
  } catch {}
  if (running) throw new Error('Stop pnpm dev before resetting local data.')
  renameSync('.local/ready.json', `.local/ready-${Date.now()}.json`)
}
if (existsSync('.local/dev-logs')) {
  const backup = `.local/dev-logs-${Date.now()}`
  renameSync('.local/dev-logs', backup)
  console.log(
    `Local dev activity files moved to ${backup}. The next start uses an empty directory.`,
  )
} else {
  console.log('No local dev activity files to reset.')
}
