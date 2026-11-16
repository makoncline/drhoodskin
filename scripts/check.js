import { spawnSync, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { refuseCredentials } from './no-credentials.js'
refuseCredentials()
mkdirSync('test-results', { recursive: true })
rmSync('test-results/e2e', { recursive: true, force: true })
let revision = 'uncommitted'
let dirty = null
try {
  revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
  dirty =
    execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().length > 0
} catch {}
const report = {
  revision,
  dirty,
  startedAt: new Date().toISOString(),
  checks: [],
  screenshots: [],
  logs: [],
}
for (const name of ['lint', 'test', 'typecheck']) {
  const start = Date.now()
  const result = spawnSync('pnpm', [name], { stdio: 'inherit' })
  report.checks.push({
    name,
    passed: result.status === 0,
    seconds: Math.round((Date.now() - start) / 100) / 10,
  })
  if (result.status !== 0) break
}
try {
  for (const file of readdirSync('test-results/e2e')) {
    if (file.endsWith('.png')) report.screenshots.push(`test-results/e2e/${file}`)
    if (file.endsWith('.logs.json')) report.logs.push(`test-results/e2e/${file}`)
  }
} catch {}
report.passed = report.checks.length === 3 && report.checks.every((c) => c.passed)
report.visualReview =
  'required: open the desktop and mobile screenshots; a passing test is not visual approval'
writeFileSync('test-results/report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (!report.passed) process.exitCode = 1
