import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'

test('built server preserves public responses and rejects unknown functions', { timeout: 20000 }, async (t) => {
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address()
  await new Promise((resolve) => socket.close(resolve))

  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  })
  t.after(async () => {
    if (server.exitCode !== null) return
    const exited = once(server, 'exit')
    server.kill('SIGTERM')
    await Promise.race([exited, delay(2000)])
    if (server.exitCode === null) {
      server.kill('SIGKILL')
      await exited
    }
  })
  await once(server, 'spawn')
  const base = `http://127.0.0.1:${port}`
  let status
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      status = await fetch(`${base}/api/status`, { signal: AbortSignal.timeout(1000) })
      if (status.ok) break
    } catch {}
    assert.equal(server.exitCode, null, 'The built server exited during startup')
    await delay(100)
  }
  assert.equal(status?.status, 200)
  assert.match(status.headers.get('content-type'), /application\/json/)
  await status.json()

  const html = await fetch(base)
  assert.equal(html.status, 200)
  assert.match(html.headers.get('content-type'), /text\/html/)
  assert.match(await html.text(), /Dr\. Hood/)

  const markdown = await fetch(base, { headers: { accept: 'text/markdown' } })
  assert.equal(markdown.status, 200)
  assert.match(markdown.headers.get('content-type'), /text\/markdown/)
  assert.match(await markdown.text(), /Hood/)

  const missing = await fetch(`${base}/_serverFn/security-smoke-missing`)
  assert.ok(missing.status >= 400)
  assert.doesNotMatch(missing.headers.get('content-type') ?? '', /text\/html/)
})
