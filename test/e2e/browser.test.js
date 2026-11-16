import assert from 'node:assert/strict'
import test from 'node:test'
import { start, browserHarness, eventually, activityRows } from './harness.js'
import { nextPatientFixture } from '../../scripts/dev/nextpatient.js'

test('patient-pages-desktop-and-mobile', async (t) => {
  const { runtime: r, json, warm } = await start(t)
  await warm()
  const requests = r.fixture.requests.length
  const { open, screenshot } = await browserHarness(t, r)
  const page = await open()
  await page.goto(r.origin + '/book')
  await page.getByRole('heading', { name: 'Book with Dr. Hood', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor()
  await screenshot(page, 'book')
  await eventually(
    () => activityRows(r).filter((row) => row.p === '/book' || row.e === 'book_page_view'),
    (rows) => assert.equal(rows.length, 1),
  )
  assert.equal(
    (await page.locator('a[href*="/appt-book"]').first().getAttribute('href')).startsWith(
      'https://nextpatient.co/',
    ),
    true,
  )
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor()
  assert.equal(r.fixture.requests.length, requests)

  const filtered = await json(
    '/api/appointments?days=mon,fri&times=early-morning,late-afternoon&avoid=08:50-09:30,14:00-14:50',
  )
  await page.goto(r.origin + new URL(filtered.pageUrl).pathname + new URL(filtered.pageUrl).search)
  assert.equal(
    await page.getByRole('button', { name: 'Mon', exact: true }).getAttribute('aria-pressed'),
    'true',
  )
  assert.equal(
    await page.getByRole('button', { name: 'Fri', exact: true }).getAttribute('aria-pressed'),
    'true',
  )
  await page.getByText('Busy 8:50 AM to 9:30 AM, 2:00 PM to 2:50 PM', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.waitForURL((url) => !url.search)
  await page.getByText('Full-body skin exam', { exact: true }).click()
  await page.waitForURL('**/book?visit=exam')
  assert.equal(await page.getByRole('radio', { name: /Full-body skin exam/ }).isChecked(), true)
  const examLinks = await page
    .locator('a[href*="/appt-book"]')
    .evaluateAll((links) => links.map((link) => link.href))
  assert.ok(examLinks.length > 0)
  assert.ok(examLinks.every((href) => new URL(href).searchParams.get('reason_id') === '56485'))
  await page.goto(r.origin)
  await page
    .getByRole('heading', { name: /Channing Hood, MD, FAAD/ })
    .first()
    .waitFor()
  await screenshot(page, 'home')
  await page.setViewportSize({ width: 1280, height: 900 })
  const bookViews = activityRows(r).filter((row) => row.e === 'book_page_view').length
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Book an appointment', exact: true })
    .click()
  await page.waitForURL('**/book')
  await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor()
  await eventually(
    () => activityRows(r).filter((row) => row.e === 'book_page_view').length,
    (count) => assert.equal(count, bookViews + 1),
  )
  await page.getByRole('button', { name: /When can you come in/ }).click()
  await page.getByRole('button', { name: 'Mon', exact: true }).click()
  await page.waitForURL('**/book?days=mon')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.waitForURL('**/book')
  assert.equal(activityRows(r).filter((row) => row.e === 'book_page_view').length, bookViews + 1)
  assert.equal(r.fixture.requests.length, requests)

  const noScript = await open({ javaScriptEnabled: false })
  await noScript.goto(r.origin + '/book')
  assert.equal(
    await noScript.getByRole('heading', { name: 'Book with Dr. Hood', exact: true }).isVisible(),
    true,
  )
  assert.ok(
    (await noScript.locator('a[href*="/appt-book"]').count()) > 0,
    'Times must be in SSR HTML',
  )
  await noScript.goto(r.origin)
  assert.ok((await noScript.getByRole('heading').count()) > 5)
})

test('patient-official-scheduler-fallback-without-javascript', async (t) => {
  const fixture = nextPatientFixture()
  fixture.modes.office = 'failed'
  fixture.modes.exam = 'empty'
  const { runtime: r } = await start(t, { fixture })
  const { open } = await browserHarness(t, r)
  const page = await open({ javaScriptEnabled: false })
  await page.goto(r.origin + '/book')
  await page.getByRole('heading', { name: 'Open times did not load.', exact: true }).waitFor()
  const fallback = page.getByRole('link', { name: 'Open the official calendar', exact: true })
  assert.equal(
    await fallback.getAttribute('href'),
    'https://nextpatient.co/p/5596/60744/appointments',
  )
  assert.equal(await page.locator('a[href*="/appt-book"]').count(), 0)
  assert.equal(fixture.requests.filter(({ reason }) => reason === '56487').length, 1)
})
