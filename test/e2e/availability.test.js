import assert from 'node:assert/strict'
import test from 'node:test'
import { start } from './harness.js'
import { nextPatientFixture } from '../../scripts/dev/nextpatient.js'
import { loadAvailability } from '../../src/lib/nextPatientSchedule.ts'
import { openAvailabilityStore, recordRun } from '../../src/server/availabilityStore.ts'

test('request-cache-single-flight-dense-results-and-poller-parser', async (t) => {
  const fixture = nextPatientFixture()
  fixture.modes.office = 'dense'
  fixture.modes.exam = 'phone-only'
  const { runtime: r, json } = await start(t, { fixture })
  const results = await Promise.all(
    Array.from({ length: 8 }, () => json('/api/appointments?limit=1')),
  )
  assert.ok(results.every((result) => result.totalDays > 20))
  const requests = fixture.requests.length
  assert.ok(requests > 0)
  assert.equal(
    new Set(fixture.requests.map(({ day, reason }) => `${day}/${reason}`)).size,
    requests,
  )
  assert.ok(fixture.requests.filter(({ reason }) => reason === '56487').length <= 31)
  assert.equal(fixture.requests.filter(({ reason }) => reason === '56485').length, 1)
  assert.ok(fixture.maxConcurrent <= 6)
  const oneDay = results[0]
  const manyDays = await json('/api/appointments?limit=20')
  assert.equal(oneDay.totalMatches, manyDays.totalMatches)
  assert.equal(oneDay.totalDays, manyDays.totalDays)
  assert.equal(oneDay.days.length, 1)
  assert.equal(oneDay.days[0].times.length, 12)
  assert.equal(manyDays.days.length, 20)
  const html = await (await r.dispatch('/book')).text()
  assert.equal(
    (html.match(/href="https:\/\/nextpatient\.co\/p\/5596\/[^" ]+\/appt-book\?/g) ?? []).length,
    12,
  )
  assert.equal(fixture.requests.length, requests)
  const exam = await json('/api/appointments?visit=exam')
  assert.equal(exam.status, 'call-to-schedule')
  assert.equal(exam.soonest, null)
  assert.equal(exam.totalMatches, 0)
  assert.equal(exam.call.phone, '(720) 604-0602')

  const pollerFixture = nextPatientFixture()
  pollerFixture.modes.office = 'horizon'
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => pollerFixture.outbound(new Request(input, init))
  try {
    const snapshot = await loadAvailability(56487)
    assert.equal(snapshot.kind, 'slots')
    assert.equal(pollerFixture.requests.length, 31)
    assert.ok(pollerFixture.maxConcurrent <= 6)
    const store = openAvailabilityStore(':memory:')
    try {
      recordRun(store, 56487, new Date().toISOString(), { availability: snapshot })
      assert.equal(
        store.prepare('SELECT slot_count FROM runs').get().slot_count,
        snapshot.days.length,
      )
      assert.equal(store.prepare('SELECT count(*) AS n FROM events').get().n, 0)
    } finally {
      store.close()
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('scheduler-markup-and-redirect-failures-use-public-fallbacks', async (t) => {
  for (const mode of [
    'unrecognized',
    'drifted-time',
    'drifted-path',
    'drifted-origin',
    'drifted-url',
    'redirect',
  ]) {
    const fixture = nextPatientFixture()
    fixture.modes.office = mode
    fixture.modes.exam = 'empty'
    const { runtime: r, json, rpc } = await start(t, { fixture })
    const failed = await json('/api/appointments', 502)
    assert.equal(failed.officialCalendar, 'https://nextpatient.co/p/5596/60744/appointments')
    const tool = await rpc('tools/call', { name: 'find_appointments' })
    assert.equal(tool.result.isError, true)
    const exam = await json('/api/appointments?visit=exam')
    assert.equal(exam.status, 'call-to-schedule')
    assert.equal(exam.otherVisit.status, 'unknown')
    const attempts = fixture.requests.length
    const page = await r.dispatch('/book')
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.match(html, /Open the official calendar/)
    assert.match(html, /href="https:\/\/nextpatient\.co\/p\/5596\/60744\/appointments"/)
    assert.equal(fixture.requests.length, attempts, 'Failed requests use the cache retry delay')
    assert.equal(fixture.requests.filter(({ reason }) => reason === '56487').length, 1)
    assert.deepEqual(r.fixtureErrors, [])
    await r.close()
  }
})
