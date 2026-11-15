import assert from 'node:assert/strict'
import test from 'node:test'
import { start } from './harness.js'
import { nextPatientFixture } from '../../scripts/dev/nextpatient.js'
import { loadAvailability } from '../../src/lib/nextPatientSchedule.ts'
import { openAvailabilityStore, recordRun } from '../../src/server/availabilityStore.ts'

function cronRunner(r) {
  return async (time) => {
    const start = r.fixture.requests.length
    const result = await r.scheduled(time)
    assert.equal(result.outcome, 'ok')
    const requests = r.fixture.requests.slice(start)
    assert.ok(requests.length <= 35, `${requests.length} external requests`)
    assert.ok(
      new Set(requests.map((request) => request.reason)).size <= 1,
      'Only one visit per invocation',
    )
    assert.equal(
      new Set(requests.map((request) => `${request.day}/${request.reason}`)).size,
      requests.length,
      'No duplicate first window',
    )
    assert.ok(r.fixture.maxConcurrent <= 6)
    return requests
  }
}

test('scheduled-refresh-budget-and-poller-parser', async (t) => {
  const { runtime: r, json } = await start(t)
  r.fixture.modes.office = 'horizon'
  r.fixture.modes.exam = 'phone-only'
  const cron = cronRunner(r)
  const now = Date.now()
  await cron(now)
  assert.equal((await cron(now)).length, 31)
  const first = await json('/api/appointments')
  assert.equal(first.status, 'open')
  const state = await r.db.prepare("SELECT * FROM availability WHERE visit = 'office'").first()
  const denverHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(now)),
  )
  assert.equal(
    state.due_at - state.checked_at,
    (denverHour >= 6 && denverHour < 22 ? 4 : 30) * 60_000,
  )
  const requests = r.fixture.requests.length
  await json('/api/appointments?fresh=true')
  await r.dispatch('/book')
  assert.equal(r.fixture.requests.length, requests)

  for (const [iso, interval] of [
    ['2026-11-16T12:59:00Z', 30],
    ['2026-11-16T13:00:00Z', 4],
    ['2026-11-17T05:00:00Z', 30],
  ]) {
    const time = Date.parse(iso)
    await r.db.prepare('UPDATE availability SET due_at = 0').run()
    await cron(time)
    const rows = (
      await r.db.prepare('SELECT * FROM availability WHERE checked_at = ?').bind(time).all()
    ).results
    assert.equal(rows.length, 1)
    assert.equal(rows[0].due_at - time, interval * 60_000)
  }

  const fixture = nextPatientFixture()
  fixture.modes.office = 'horizon'
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => fixture.outbound(new Request(input, init))
  try {
    const snapshot = await loadAvailability(56487)
    assert.equal(snapshot.kind, 'slots')
    assert.equal(fixture.requests.length, 31)
    assert.ok(fixture.maxConcurrent <= 6)
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

test('persisted-backoff-stale-data-and-recovery', async (t) => {
  const { runtime: r, json, rpc, warm } = await start(t)
  await warm()
  const good = await json('/api/appointments')
  const cron = cronRunner(r)
  let now = Date.now() + 31 * 60_000
  r.fixture.modes.office = 'failed'
  const officeAttempts = () =>
    r.fixture.requests.filter((request) => request.reason === '56487').length
  let attempts = officeAttempts()
  for (const delay of [60_000, 120_000, 240_000, 480_000, 900_000, 900_000]) {
    await cron(now)
    await cron(now)
    assert.equal(officeAttempts(), ++attempts)
    const row = await r.db.prepare("SELECT * FROM availability WHERE visit = 'office'").first()
    assert.equal(row.retry_ms, delay)
    assert.equal(row.due_at, now + delay)
    assert.match(row.error, /503/)
    assert.deepEqual(await json('/api/appointments'), {
      ...good,
      otherVisit: (await json('/api/appointments')).otherVisit,
    })
    assert.ok((await rpc('tools/call', { name: 'find_appointments' })).result.structuredContent)
    assert.equal(officeAttempts(), attempts)
    await cron(now + delay - 1)
    assert.equal(officeAttempts(), attempts)
    now += delay
  }
  const staleHtml = await (await r.dispatch('/book')).text()
  assert.match(staleHtml, /refresh|checked/i)
  r.fixture.modes.office = 'slots'
  await cron(now)
  await cron(now)
  const recovered = await r.db.prepare("SELECT * FROM availability WHERE visit = 'office'").first()
  assert.equal(recovered.retry_ms, 0)
  assert.equal(recovered.error, null)
  assert.equal(recovered.checked_at, now)
  r.fixture.modes.office = 'failed'
  now = recovered.due_at
  await cron(now)
  await cron(now)
  assert.equal(
    (await r.db.prepare("SELECT retry_ms FROM availability WHERE visit = 'office'").first())
      .retry_ms,
    60_000,
  )
  await r.db
    .prepare("UPDATE availability SET checked_at = ? WHERE visit = 'office'")
    .bind(Date.now() - 6 * 60 * 60_000)
    .run()
  const before = r.fixture.requests.length
  assert.equal((await r.dispatch('/api/appointments')).status, 502)
  assert.equal((await rpc('tools/call', { name: 'find_appointments' })).result.isError, true)
  const exam = await json('/api/appointments?visit=exam')
  assert.equal(exam.otherVisit.status, 'unknown')
  assert.equal(r.fixture.requests.length, before)
  const failures = r.logs.filter((log) => JSON.stringify(log).includes('[availability] office:'))
  assert.equal(failures.length, 7)
})

test('scheduler-markup-drift-and-call-guidance', async (t) => {
  const { runtime: r, json, rpc } = await start(t)
  const cron = cronRunner(r)
  let now = Date.now()
  r.fixture.modes.exam = 'empty'
  await cron(now)
  for (const mode of [
    'unrecognized',
    'drifted-time',
    'drifted-path',
    'drifted-origin',
    'drifted-url',
    'redirect',
  ]) {
    r.fixture.modes.office = mode
    await cron(now)
    await cron(now)
    const row = await r.db.prepare("SELECT * FROM availability WHERE visit = 'office'").first()
    assert.equal(row.checked_at, null)
    assert.match(
      row.error,
      mode === 'unrecognized'
        ? /Unrecognized scheduler response/
        : mode === 'redirect'
          ? /302/
          : /Unrecognized scheduler slots/,
    )
    assert.equal((await r.dispatch('/api/appointments')).status, 502)
    assert.equal((await rpc('tools/call', { name: 'find_appointments' })).result.isError, true)
    assert.equal((await json('/api/appointments?visit=exam')).otherVisit.status, 'unknown')
    const before = r.fixture.requests.length
    await cron(row.due_at - 1)
    assert.equal(
      r.fixture.requests.filter((request) => request.reason === '56487').length,
      r.fixture.requests.slice(0, before).filter((request) => request.reason === '56487').length,
    )
    now = row.due_at
  }
  for (const mode of ['phone-only', 'empty']) {
    r.fixture.modes.office = mode
    await cron(now)
    await cron(now)
    const result = await json('/api/appointments')
    assert.equal(result.status, 'call-to-schedule')
    assert.equal(result.soonest, null)
    assert.equal(result.totalMatches, 0)
    assert.equal(result.call.phone, '(720) 604-0602')
    const row = await r.db.prepare("SELECT * FROM availability WHERE visit = 'office'").first()
    assert.equal(row.retry_ms, 0)
    now = row.due_at
  }
})
