import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { startRuntime } from './dev/runtime.js'
import { refuseCredentials } from './no-credentials.js'

export async function localActivityRows(persist = '.local/wrangler-d1') {
  refuseCredentials()
  const runtime = await startRuntime({ persist })
  try {
    return (await runtime.db.prepare('SELECT * FROM activity ORDER BY t, id').all()).results
  } finally {
    await runtime.close()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] ?? '.local/activity.json'
  const rows = await localActivityRows()
  writeFileSync(path, JSON.stringify(rows, null, 2), { flag: 'wx' })
  console.log(`Exported ${rows.length} activity rows to ${path}`)
}
