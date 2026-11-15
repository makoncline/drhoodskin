import { readdirSync } from 'node:fs'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
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
    compatibilityDate: '2026-11-03',
    compatibilityFlags: ['nodejs_compat'],
    handleStructuredLogs: (log) => {
      logs.push(log)
      onLog(log)
    },
    d1Databases: ['DB'],
    ...(persist ? { resourcePersistencePath: persist } : {}),
    assets: {
      directory: './dist/client',
      binding: 'ASSETS',
      routerConfig: { has_user_worker: true },
    },
    outboundService: fixture.outbound,
  }
  const mf = new Miniflare(convertV4MiniflareOptions(options))
  try {
    const origin = (await mf.ready).origin
    const db = await mf.getD1Database('DB')
    await migrateLocalDatabase(db)
    const worker = await mf.getWorker()
    return {
      origin,
      db,
      fixture,
      logs,
      dispatch: (path, init) => mf.dispatchFetch(origin + path, init),
      scheduled: (time = Date.now()) =>
        worker.scheduled({ scheduledTime: time, cron: '* * * * *' }),
      close: () => mf.dispose(),
    }
  } catch (error) {
    await mf.dispose()
    throw error
  }
}
