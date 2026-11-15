import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { start, eventually } from './harness.js'
import { activityDay } from '../../src/lib/activity.ts'
import { readActivityRows, summarizeActivity } from '../../src/server/activityReport.ts'
import { localActivityRows } from '../../scripts/activity-export.js'

test('activity-persistence-salt-retention-and-export', async (t) => {
  mkdirSync('.local', { recursive: true })
  const persist = mkdtempSync('.local/activity-test-')
  t.after(() => rmSync(persist, { recursive: true, force: true }))
  const { runtime: first } = await start(t, { persist })
  const human = {
    'user-agent': 'Mozilla/5.0 Chrome/130.0',
    'cf-connecting-ip': '198.51.100.7',
    'cf-ipcountry': 'US',
    referer: 'https://www.google.com/search?q=private',
  }
  for (const path of ['/', '/book'])
    assert.equal((await first.dispatch(path, { headers: human })).status, 200)
  await Promise.all(
    ['hero_book_page_click', 'book_page_view', 'book_schedule_click'].map((e) =>
      first.dispatch('/api/events', {
        method: 'POST',
        headers: human,
        body: JSON.stringify({ e }),
      }),
    ),
  )
  await first.dispatch('/llms.txt', {
    headers: { 'user-agent': 'ChatGPT-User/1.0', accept: 'text/markdown' },
  })
  const initial = await eventually(
    () => first.db.prepare('SELECT * FROM activity ORDER BY id').all(),
    ({ results }) => assert.equal(results.length, 6),
  )
  const people = initial.results.filter((row) => row.a === 'human')
  assert.equal(new Set(people.map((row) => row.v)).size, 1)
  assert.match(people[0].v, /^[a-f0-9]{12}$/)
  assert.equal(people[0].r, 'www.google.com')
  assert.doesNotMatch(JSON.stringify(initial.results), /198\.51\.100|private|Chrome/)
  const salt = await first.db.prepare('SELECT * FROM visitor_salts').first()
  assert.equal(salt.day, activityDay(new Date()))
  assert.equal((await first.db.prepare('SELECT count(*) AS n FROM visitor_salts').first()).n, 1)
  first.fixture.modes.exam = 'failed'
  await first.scheduled()
  const failed = await first.db
    .prepare("SELECT * FROM availability WHERE visit = 'full-body-exam'")
    .first()
  assert.equal(failed.retry_ms, 60_000)
  await first.close()

  const { runtime: second } = await start(t, { persist })
  await second.dispatch('/api/events', {
    method: 'POST',
    headers: human,
    body: '{"e":"visit_call_click"}',
  })
  await eventually(
    () => second.db.prepare("SELECT v FROM activity WHERE e = 'visit_call_click'").first(),
    (row) => assert.equal(row?.v, people[0].v),
  )
  assert.deepEqual(await second.db.prepare('SELECT * FROM visitor_salts').first(), salt)
  assert.deepEqual(
    await second.db.prepare("SELECT * FROM availability WHERE visit = 'full-body-exam'").first(),
    failed,
  )
  await second.scheduled(failed.due_at - 1)
  assert.equal(second.fixture.requests.filter((request) => request.reason === '56485').length, 0)

  const now = Date.now()
  const utcDay = new Date(now).toISOString().slice(0, 10)
  const boundary = new Date(`${utcDay}T00:00:00Z`)
  boundary.setUTCDate(boundary.getUTCDate() - 180)
  const old = new Date(boundary.getTime() - 1).toISOString()
  await second.db.batch([
    second.db
      .prepare("INSERT INTO activity (t,k,p,a) VALUES (?,'request','/old','other-bot')")
      .bind(old),
    second.db
      .prepare("INSERT INTO activity (t,k,p,a) VALUES (?,'request','/boundary','other-bot')")
      .bind(boundary.toISOString()),
    second.db.prepare("INSERT INTO visitor_salts VALUES ('2000-01-01','obsolete')"),
    second.db.prepare("DELETE FROM maintenance WHERE name = 'activity'"),
  ])
  await second.scheduled(now)
  assert.equal(
    (await second.db.prepare("SELECT count(*) AS n FROM activity WHERE p = '/old'").first()).n,
    0,
  )
  assert.equal(
    (await second.db.prepare("SELECT count(*) AS n FROM activity WHERE p = '/boundary'").first()).n,
    1,
  )
  assert.equal(
    (
      await second.db
        .prepare("SELECT count(*) AS n FROM visitor_salts WHERE day = '2000-01-01'")
        .first()
    ).n,
    0,
  )
  assert.equal((await second.db.prepare('SELECT * FROM visitor_salts').first()).salt, salt.salt)
  await second.db
    .prepare("INSERT INTO activity (t,k,p,a) VALUES (?,'request','/old','other-bot')")
    .bind(old)
    .run()
  await second.scheduled(now)
  assert.equal(
    (await second.db.prepare("SELECT count(*) AS n FROM activity WHERE p = '/old'").first()).n,
    1,
  )
  await second.scheduled(now + 86_400_000)
  assert.equal(
    (
      await second.db
        .prepare("SELECT count(*) AS n FROM activity WHERE p IN ('/old','/boundary')")
        .first()
    ).n,
    0,
  )
  await second.close()

  const rows = await localActivityRows(persist)
  const exported = 'test-results/e2e/activity-export.json'
  writeFileSync(exported, JSON.stringify(rows, null, 2))
  const summary = summarizeActivity(readActivityRows(rows, 7))
  assert.equal(summary.pageViews, 1)
  assert.equal(summary.bookPageViews, 2)
  assert.equal(summary.visitorDays, 1)
  assert.equal(summary.booking.schedule, 1)
  assert.equal(summary.booking.call, 1)
  assert.equal(summary.bookingVisitorDays, 1)
  assert.equal(summary.bookingRate, 1)
  assert.deepEqual(summary.aiAgents, [['ChatGPT-User', 1]])
  assert.equal(summary.markdownRequests, 1)
  const cli = execFileSync(
    process.execPath,
    ['scripts/activity-report.ts', `--file=${exported}`, '--days=7', '--json'],
    { encoding: 'utf8' },
  )
  assert.deepEqual(JSON.parse(cli), summary)
})
