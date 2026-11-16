import { readdirSync, readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { parse } from 'jsonc-parser'
import { migrateLocalDatabase } from './migrate.js'
import { nextPatientFixture } from './nextpatient.js'

export async function startRuntime({
  https = false,
  persist,
  port = 0,
  onLog = () => {},
  fixture = nextPatientFixture(),
} = {}) {
  const logs = []
  const config = parse(readFileSync('wrangler.jsonc', 'utf8'))
  mkdirSync('.local', { recursive: true })
  const storage = persist ?? mkdtempSync('.local/e2e-d1-')
  const cleanup = () => {
    if (!persist) rmSync(storage, { recursive: true, force: true })
  }
  try {
    migrateLocalDatabase(storage)
  } catch (error) {
    cleanup()
    throw error
  }
  const options = {
    host: '127.0.0.1',
    port,
    https,
    cf: false,
    name: 'local-app',
    modules: readdirSync('dist/server', { recursive: true })
      .filter((file) => file.endsWith('.js'))
      .sort((a, b) => (a === 'index.js' ? -1 : b === 'index.js' ? 1 : 0))
      .map((file) => ({ type: 'ESModule', path: `dist/server/${file}` })),
    modulesRoot: 'dist/server',
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    handleStructuredLogs: (log) => {
      logs.push(log)
      onLog(log)
    },
    d1Databases: { DB: config.d1_databases[0].database_id },
    resourcePersistencePath: `${storage}/v3`,
    assets: {
      directory: './dist/client',
      binding: 'ASSETS',
      run_worker_first: config.assets.run_worker_first,
      routerConfig: { has_user_worker: true },
    },
    outboundService: fixture.outbound,
  }
  const mf = new Miniflare(convertV4MiniflareOptions(options))
  try {
    const origin = (await mf.ready).origin
    const db = await mf.getD1Database('DB')
    const worker = await mf.getWorker()
    return {
      origin,
      db,
      fixture,
      logs,
      dispatch: (path, init) => mf.dispatchFetch(origin + path, init),
      scheduled: (time = Date.now()) =>
        worker.scheduled({ scheduledTime: time, cron: '* * * * *' }),
      close: async () => {
        await mf.dispose()
        cleanup()
      },
    }
  } catch (error) {
    await mf.dispose()
    cleanup()
    throw error
  }
}
