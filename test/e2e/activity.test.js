import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { start, eventually, activityRows } from './harness.js'
import { activityDay } from '../../src/lib/activity.ts'
import { readActivityRows, summarizeActivity } from '../../src/server/activityReport.ts'
import { localActivityRows } from '../../scripts/activity-export.js'

test('activity-persistence-visitor-identity-and-export', async (t) => {
  mkdirSync('.local', { recursive: true })
  const persist = mkdtempSync('.local/activity-test-')
  const runtimes = []
  t.after(async () => {
    await Promise.all(runtimes.map((runtime) => runtime.close()))
    rmSync(persist, { recursive: true, force: true })
  })
  const { runtime: first } = await start(t, { persist })
  runtimes.push(first)
  const human = {
    'user-agent': 'Mozilla/5.0 Chrome/130.0',
    'x-forwarded-for': '198.51.100.7',
    'cf-ipcountry': 'US',
    referer: 'https://www.google.com/search?q=private',
  }
  for (const path of ['/', '/book']) {
    const response = await first.dispatch(path, { headers: human })
    assert.equal(response.status, 200)
    await response.text()
  }
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
    () => activityRows(first),
    (rows) => assert.equal(rows.length, 6),
  )
  const people = initial.filter((row) => row.a === 'human')
  assert.equal(new Set(people.map((row) => row.v)).size, 1)
  assert.match(people[0].v, /^[a-f0-9]{12}$/)
  assert.equal(people[0].r, 'www.google.com')
  assert.equal(/198\.51\.100|private|Chrome/.test(JSON.stringify(initial)), false)
  const saltName = `visitor-salt-${activityDay(new Date())}`
  assert.deepEqual(
    readdirSync(persist).filter((file) => file.startsWith('visitor-salt-')),
    [saltName],
  )
  const saltFile = statSync(join(persist, saltName))
  assert.equal(saltFile.mode & 0o777, 0o600)
  await first.close()

  const { runtime: second } = await start(t, { persist })
  runtimes.push(second)
  assert.notEqual(second.pid, first.pid)
  await second.dispatch('/api/events', {
    method: 'POST',
    headers: human,
    body: '{"e":"visit_call_click"}',
  })
  await eventually(
    () => activityRows(second).find((row) => row.e === 'visit_call_click'),
    (row) =>
      assert.equal(row?.v === people[0].v, true, 'Visitor identity survives a process restart'),
  )
  const persistedSalt = statSync(join(persist, saltName))
  assert.equal(persistedSalt.ino, saltFile.ino)
  assert.equal(persistedSalt.mtimeMs, saltFile.mtimeMs)
  await second.close()

  const rows = localActivityRows(persist)
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
  const exported = join(persist, 'export.json')
  const env = { ...process.env, LOG_DIR: first.logDir }
  execFileSync(process.execPath, ['scripts/activity-export.js', exported], { env, stdio: 'pipe' })
  for (const args of [[], [`--file=${exported}`]]) {
    const output = execFileSync(
      process.execPath,
      ['scripts/activity-report.ts', ...args, '--days=7', '--json'],
      {
        env,
        encoding: 'utf8',
      },
    )
    assert.deepEqual(JSON.parse(output), summary)
  }
  assert.throws(
    () =>
      execFileSync(process.execPath, ['scripts/activity-export.js', exported], {
        env,
        stdio: 'pipe',
      }),
    'An export must not overwrite an existing file',
  )
  writeFileSync(join(persist, 'activity-2000-01-01.jsonl'), 'invalid old line')
  const current = readdirSync(persist).find(
    (name) => /^activity-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) && !name.includes('2000-'),
  )
  assert.ok(current)
  appendFileSync(join(persist, current), '{"truncated":')
  const report = spawnSync(process.execPath, ['scripts/activity-report.ts', '--days=7', '--json'], {
    env,
    encoding: 'utf8',
  })
  assert.equal(report.status, 0, report.stderr)
  assert.deepEqual(JSON.parse(report.stdout), summary)
  assert.match(report.stderr, /skipped 1 invalid line/)
  assert.throws(() =>
    execFileSync(
      process.execPath,
      ['scripts/activity-export.js', join(persist, 'strict-export.json')],
      { env, stdio: 'pipe' },
    ),
  )
})

test('activity-storage-failure-keeps-patient-and-agent-requests-working', async (t) => {
  mkdirSync('.local', { recursive: true })
  const root = mkdtempSync('.local/storage-failure-')
  const persist = join(root, 'logs')
  const { runtime: r, json } = await start(t, { persist })
  t.after(async () => {
    await r.close()
    rmSync(root, { recursive: true, force: true })
  })
  renameSync(persist, join(root, 'saved'))
  writeFileSync(persist, 'Not a directory')
  const page = await r.dispatch('/', { headers: { 'user-agent': 'Mozilla/5.0 Chrome/157.0' } })
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Dr\. Hood/)
  await eventually(
    () => r.logs,
    (logs) => {
      assert.ok(logs.some((log) => log.message === 'Activity log write failed'))
      assert.ok(
        logs.some(
          (log) =>
            log.k === 'request' &&
            log.p === '/' &&
            log.a === 'human' &&
            /^[a-f0-9]{12}$/.test(log.v),
        ),
      )
    },
  )
  assert.equal((await json('/api/appointments')).status, 'open')
  assert.ok(r.fixture.requests.length > 0)
  assert.equal((await r.dispatch('/book')).status, 200)
  const originalVisitor = r.logs.find(
    (log) => log.k === 'request' && log.p === '/' && log.a === 'human',
  ).v
  renameSync(persist, join(root, 'not-a-directory-fixture'))
  renameSync(join(root, 'saved'), persist)
  writeFileSync(join(persist, `visitor-salt-${activityDay(new Date())}`), '', {
    flag: 'wx',
    mode: 0o600,
  })
  const recovered = await r.dispatch('/', { headers: { 'user-agent': 'Mozilla/5.0 Chrome/157.0' } })
  assert.equal(recovered.status, 200)
  await eventually(
    () => activityRows(r).find((row) => row.p === '/' && row.a === 'human'),
    (row) => {
      assert.equal(
        row?.v,
        originalVisitor,
        'A malformed salt must not lose activity or change the process-local visitor',
      )
    },
  )
})
