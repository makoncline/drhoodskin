import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createServer as createSocketServer, connect } from 'node:net'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { nextPatientFixture } from './nextpatient.js'

async function listen(server, port = 0) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return server.address().port
}

async function unusedPort(port = 0) {
  const server = createSocketServer()
  const available = await listen(server, port)
  await new Promise((resolve) => server.close(resolve))
  return available
}

async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.kill('SIGTERM')
  })
}

async function listening(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    socket.setTimeout(200)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export async function startRuntime({
  persist,
  port = 0,
  onLog = () => {},
  fixture = nextPatientFixture(),
} = {}) {
  const logs = []
  const fixtureErrors = []
  mkdirSync('.local', { recursive: true })
  const storage = resolve(persist ?? mkdtempSync('.local/e2e-node-'))
  mkdirSync(storage, { recursive: true })
  let child, closing
  const bridge = createServer(async (request, response) => {
    try {
      if (request.method !== 'POST' || request.url !== '/fetch')
        throw new Error('Invalid fixture request')
      let body = ''
      for await (const chunk of request) {
        body += chunk
        if (body.length > 4096) throw new Error('Invalid fixture request')
      }
      const { url, method } = JSON.parse(body)
      const result = await fixture.outbound(new Request(url, { method }))
      response.writeHead(result.status, Object.fromEntries(result.headers))
      response.end(Buffer.from(await result.arrayBuffer()))
    } catch {
      fixtureErrors.push('Unexpected outbound request blocked')
      response.writeHead(502)
      response.end('Unexpected outbound request blocked')
    }
  })
  function close() {
    closing ??= (async () => {
      await stopChild(child)
      bridge.closeAllConnections()
      await new Promise((resolve) => bridge.close(resolve))
      if (!persist) rmSync(storage, { recursive: true, force: true })
    })()
    return closing
  }
  try {
    const fixturePort = await listen(bridge)
    const appPort = await unusedPort(port)
    const origin = `http://127.0.0.1:${appPort}`
    child = spawn(
      process.execPath,
      [
        '--import',
        fileURLToPath(new URL('./fixture-preload.js', import.meta.url)),
        '.output/server/index.mjs',
      ],
      {
        env: {
          ...process.env,
          HOST: '127.0.0.1',
          PORT: String(appPort),
          NITRO_HOST: '127.0.0.1',
          NITRO_PORT: String(appPort),
          LOG_DIR: storage,
          NEXT_PATIENT_FIXTURE_URL: `http://127.0.0.1:${fixturePort}/fetch`,
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      },
    )
    let launchError
    child.once('error', (error) => {
      launchError = error
    })
    for (const [stream, level] of [
      [child.stdout, 'info'],
      [child.stderr, 'error'],
    ]) {
      let pending = ''
      const record = (line) => {
        if (!line) return
        let log
        try {
          log = JSON.parse(line)
        } catch {
          log = { level, message: line }
        }
        logs.push(log)
        onLog(log)
      }
      stream.setEncoding('utf8')
      stream.on('data', (chunk) => {
        pending += chunk
        const lines = pending.split('\n')
        pending = lines.pop()
        lines.forEach(record)
      })
      stream.on('end', () => record(pending))
    }
    const until = Date.now() + 20_000
    while (!(await listening(appPort))) {
      if (launchError) throw launchError
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Built Node server stopped before it was ready. Inspect runtime logs.')
      if (Date.now() >= until) throw new Error('Built Node server did not start within 20 seconds')
      await delay(20)
    }
    return {
      origin,
      fixture,
      logs,
      fixtureErrors,
      logDir: storage,
      pid: child.pid,
      dispatch(path, init) {
        const url = new URL(path, origin)
        if (url.origin !== origin || url.pathname.includes('/appt-book'))
          throw new Error('Only local application requests are allowed')
        return fetch(url, { ...init, redirect: 'manual' })
      },
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
