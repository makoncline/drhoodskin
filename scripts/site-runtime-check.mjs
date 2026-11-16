import assert from 'node:assert/strict'
import test from 'node:test'
import { startRuntime } from './dev/runtime.js'
import { nextPatientFixture } from './dev/nextpatient.js'
import { refuseCredentials } from './no-credentials.js'

refuseCredentials()

test(
  'production Node image serves patients, agents, and dense booking times',
  { timeout: 20000 },
  async (t) => {
    const fixture = nextPatientFixture()
    fixture.modes.office = 'dense'
    fixture.modes.exam = 'dense'
    const runtime = await startRuntime({ fixture })
    t.after(async () => {
      await runtime.close()
      assert.deepEqual(runtime.fixtureErrors, [])
    })
    const status = await runtime.dispatch('/api/status')
    assert.equal(status.status, 200)
    assert.equal((await status.json()).status, 'ok')
    assert.ok(status.headers.get('x-correlation-id'))
    assert.equal(status.headers.get('x-release'), process.env.APP_REVISION ?? 'local')
    const home = await runtime.dispatch('/')
    assert.equal(home.status, 200)
    assert.match(home.headers.get('content-type'), /text\/html/)
    assert.match(home.headers.get('link'), /openapi/)
    assert.match(await home.text(), /Dr\. Hood/)
    const markdown = await runtime.dispatch('/', { headers: { accept: 'text/markdown' } })
    assert.match(markdown.headers.get('content-type'), /text\/markdown/)
    assert.match(await markdown.text(), /Hood/)
    const tools = await runtime.dispatch('/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    assert.equal(tools.status, 200)
    assert.ok((await tools.json()).result.tools.some((tool) => tool.name === 'find_appointments'))
    for (const visit of ['office', 'exam']) {
      const response = await runtime.dispatch(`/api/appointments?visit=${visit}&limit=1`)
      assert.equal(response.status, 200)
      const appointments = await response.json()
      assert.ok(appointments.totalDays > 20)
      assert.equal(appointments.days[0].times.length, 12)
    }
    const reads = fixture.requests.length
    for (const path of ['/book', '/book?visit=exam']) {
      const response = await runtime.dispatch(path)
      assert.equal(response.status, 200)
      const html = await response.text()
      assert.match(html, /Book with Dr\. Hood/)
      assert.equal((html.match(/aria-label="Book [^"]+"/g) ?? []).length, 12)
    }
    assert.equal(fixture.requests.length, reads, 'SSR must reuse the API cache')
    const missing = await runtime.dispatch('/_serverFn/security-smoke-missing')
    assert.ok(missing.status >= 400)
    assert.doesNotMatch(missing.headers.get('content-type') ?? '', /text\/html/)
  },
)
