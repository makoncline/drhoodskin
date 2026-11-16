import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import { chromium } from 'playwright'
import { startRuntime } from '../../scripts/dev/runtime.js'
import { refuseCredentials } from '../../scripts/no-credentials.js'
import { localActivityRows } from '../../scripts/activity-export.js'

export const activityRows = (runtime) => localActivityRows(runtime.logDir)

export async function eventually(read, verify) {
  const until = Date.now() + 5000
  for (;;) {
    const value = await read()
    try {
      verify(value)
      return value
    } catch (error) {
      if (Date.now() >= until) throw error
    }
    await setTimeout(20)
  }
}

export async function start(t, options = {}) {
  refuseCredentials()
  mkdirSync('test-results/e2e', { recursive: true })
  const runtime = await startRuntime(options)
  t.after(async () => {
    await runtime.close()
    writeFileSync(
      `test-results/e2e/${t.name}-${runtime.pid}.logs.json`,
      JSON.stringify(runtime.logs, null, 2),
    )
    assert.deepEqual(
      runtime.fixtureErrors,
      [],
      'The server must not make unexpected outbound requests',
    )
  })
  const json = async (path, status = 200, init) => {
    const response = await runtime.dispatch(path, init)
    assert.equal(response.status, status, await response.clone().text())
    return response.json()
  }
  const rpc = (method, params, status = 200, suffix = '') =>
    json('/mcp' + suffix, status, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
  const warm = () => json('/api/appointments')
  return { runtime, json, rpc, warm }
}

export async function browserHarness(t, runtime) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--proxy-server=direct://', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
  })
  t.after(() => browser.close())
  const errors = []
  t.after(() => assert.deepEqual(errors, []))
  async function open(options = {}) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      serviceWorkers: 'block',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
      ...options,
    })
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (url.origin === runtime.origin) return route.continue()
      if (url.hostname === 'maps.google.com' && url.pathname === '/maps') return route.abort()
      errors.push(`Unexpected browser request: ${url.origin}${url.pathname}`)
      return route.abort()
    })
    const page = await context.newPage()
    page.on('pageerror', (error) =>
      errors.push(`${new URL(page.url()).pathname}: ${error.message}`),
    )
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !message.location().url.startsWith('https://maps.google.com/maps')
      )
        errors.push(message.text())
    })
    return page
  }
  async function screenshot(page, name) {
    for (const [size, viewport] of [
      ['desktop', { width: 1280, height: 900 }],
      ['mobile', { width: 390, height: 844 }],
    ]) {
      await page.setViewportSize(viewport)
      await page.evaluate(async () => {
        await document.fonts.ready
        for (let y = 0; y < document.body.scrollHeight; y += 600) window.scrollTo(0, y)
        window.scrollTo(0, 0)
      })
      await page.screenshot({
        path: `test-results/e2e/${name}-${size}.png`,
        fullPage: true,
        animations: 'disabled',
      })
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      )
    }
  }
  return { open, screenshot }
}
