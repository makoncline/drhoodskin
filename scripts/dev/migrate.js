import { spawnSync } from 'node:child_process'

export function migrateLocalDatabase(persist) {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'migrations',
      'apply',
      'drhoodskin',
      '--local',
      '--persist-to',
      persist,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    },
  )
  if (result.status !== 0)
    throw new Error(`Local D1 migration failed.\n${result.stdout}\n${result.stderr}`)
}
