import assert from 'node:assert/strict'
import test from 'node:test'
import { start, eventually, activityRows } from './harness.js'
import { addDays } from '../../src/lib/nextPatientSchedule.ts'

const calendar = 'https://nextpatient.co/p/5596/60744/appointments'

test('public-agent-and-appointment-boundaries', async (t) => {
  const { runtime: r, json, rpc } = await start(t)
  const home = await r.dispatch('/')
  assert.equal(home.status, 200)
  assert.match(home.headers.get('link'), /openapi/)
  assert.ok(home.headers.get('x-correlation-id'))
  assert.match(await home.text(), /Dr\. Hood/)
  const homeWithQuery = await r.dispatch('/?utm_source=fixture')
  assert.equal(homeWithQuery.status, 200)
  assert.match(await homeWithQuery.text(), /Dr\. Hood/)
  assert.notEqual(
    homeWithQuery.headers.get('x-correlation-id'),
    home.headers.get('x-correlation-id'),
  )
  const head = await r.dispatch('/', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.match(head.headers.get('link'), /openapi/)
  const markdown = await r.dispatch('/', { headers: { accept: 'text/markdown, text/html' } })
  assert.match(markdown.headers.get('content-type'), /text\/markdown/)
  assert.equal(markdown.headers.get('vary'), 'Accept')
  assert.ok(Number(markdown.headers.get('x-markdown-tokens')) > 0)
  assert.match(await markdown.text(), /Hood/)
  for (const [path, type] of [
    ['/llms.txt', 'text/markdown'],
    ['/sitemap.xml', 'application/xml'],
    ['/robots.txt', 'text/plain'],
    ['/.well-known/api-catalog', 'application/linkset+json'],
    ['/.well-known/agent-guide.md', 'text/markdown'],
    ['/openapi.json', 'application/openapi+json'],
    ['/.well-known/mcp/server-card.json', 'application/json'],
  ]) {
    const response = await r.dispatch(path)
    assert.equal(response.status, 200, path)
    assert.ok(response.headers.get('content-type').startsWith(type), path)
    const text = await response.text()
    if (path === '/sitemap.xml') assert.match(text, /https:\/\/drhoodskin.com\/book/)
    if (path === '/robots.txt') assert.match(text, /ai-train=no/)
  }
  const skills = await json('/.well-known/agent-skills/index.json')
  assert.equal(skills.skills.length, 2)
  for (const skill of skills.skills)
    assert.equal((await r.dispatch(new URL(skill.url).pathname)).status, 200)
  for (const path of [
    '/api',
    '/api/status',
    '/api/profile',
    '/api/office',
    '/api/contact',
    '/api/forms',
    '/api/insurance',
    '/api/booking',
  ])
    await json(path)
  const services = await json('/api/services?category=medical')
  assert.equal(services.category, 'medical')
  assert.ok(services.medical.length > 0)
  assert.equal(
    (await json('/api/faq?question=Do%20you%20take%20insurance')).matchedQuestion,
    'What should I know about insurance coverage?',
  )
  const search = await json('/api/search?q=eczema%20insurance&limit=2')
  assert.ok(search.results.length > 0 && search.results.length <= 2)
  assert.equal((await r.dispatch('/dev/scheduler')).status, 404)
  const unknownFn = await r.dispatch('/_serverFn/security-smoke-missing')
  assert.ok(unknownFn.status >= 400)
  assert.doesNotMatch(unknownFn.headers.get('content-type') ?? '', /text\/html/)

  assert.equal(r.fixture.requests.length, 0)
  const first = await json('/api/appointments')
  assert.ok(r.fixture.requests.length > 0, 'A normal GET warms the in-process cache')
  const requests = r.fixture.requests.length
  assert.equal(first.visit, 'office')
  assert.equal(first.timeZone, 'America/Denver')
  assert.equal(first.status, 'open')
  assert.equal(first.totalMatches, 16)
  assert.equal(first.totalDays, 7)
  assert.equal(first.days.length, 5)
  assert.equal(first.soonest.date, r.fixture.officeStart)
  assert.equal(first.soonest.time, '8:40 AM')
  assert.equal(first.officialCalendar, calendar)
  assert.equal(first.pageUrl, 'https://drhoodskin.com/book')
  assert.equal(first.otherVisit.soonest.date, r.fixture.monday)
  assert.match(first.instructions, /Never offer an office-visit time for a full-body exam/)
  assert.match(
    first.days[0].times[0].bookingUrl,
    /^https:\/\/nextpatient.co\/p\/5596\/\d+\/appt-book\?reason_id=56487&location_id=5596$/,
  )
  for (const visit of ['', 'office'])
    assert.equal((await json(`/api/appointments?visit=${visit}`)).totalMatches, 16)
  for (const visit of ['exam', 'full-body-exam']) {
    const exam = await json(`/api/appointments?visit=${visit}`)
    assert.equal(exam.visit, 'full-body-exam')
    assert.equal(exam.totalMatches, 2)
    assert.equal(exam.days[0].times[0].time, '2:30 PM')
    assert.match(exam.days[0].times[0].bookingUrl, /reason_id=56485/)
    assert.equal(exam.pageUrl, 'https://drhoodskin.com/book?visit=exam')
  }
  assert.match((await json('/api/appointments?visit=unknown', 400)).error, /Invalid visit/)
  const repeated = await json(
    '/api/appointments?days=mon&days=fri&times=early-morning&times=late-afternoon&avoid=08:50-09:30&avoid=14:00-14:50&limit=2',
  )
  assert.equal(repeated.totalMatches, 5)
  assert.equal(repeated.totalDays, 3)
  assert.equal(repeated.days.length, 2)
  assert.deepEqual(
    repeated.days[0].times.map((time) => time.time),
    ['8:40 AM'],
  )
  assert.deepEqual(
    repeated.days[1].times.map((time) => time.time),
    ['8:40 AM', '9:30 AM', '2:50 PM'],
  )
  assert.deepEqual(
    await json(
      '/api/appointments?days=mon,fri&times=early-morning,late-afternoon&avoid=08:50-09:30,14:00-14:50&limit=2',
    ),
    repeated,
  )
  assert.equal((await json('/api/appointments?limit=0')).days.length, 1)
  assert.equal((await json('/api/appointments?limit=not-a-number')).days.length, 5)
  const none = await json('/api/appointments?days=sun')
  assert.equal(none.status, 'open')
  assert.equal(none.totalMatches, 0)
  assert.equal(none.days.length, 0)
  assert.equal(none.soonest.time, '8:40 AM')
  for (const visit of ['office', 'full-body-exam']) {
    const filtered = await json(
      `/api/appointments?visit=${visit}&days=mon,fri&times=late-morning,late-afternoon&avoid=14:00-15:00,11:00-12:00`,
    )
    const pageUrl = new URL(filtered.pageUrl)
    assert.equal(filtered.totalMatches, 1)
    assert.equal(
      filtered.days[0].date,
      visit === 'office' ? r.fixture.officeStart : addDays(r.fixture.monday, 4),
    )
    assert.deepEqual(await json('/api/appointments' + pageUrl.search), filtered)
    const page = await r.dispatch('/book' + pageUrl.search)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Mondays or Fridays/)
  }
  const initialized = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {} })
  assert.equal(initialized.result.protocolVersion, '2025-06-18')
  assert.equal(initialized.result.serverInfo.name, 'drhoodskin-mcp')
  const tools = (await rpc('tools/list')).result.tools
  assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length)
  assert.deepEqual(
    tools.find((tool) => tool.name === 'find_appointments').inputSchema.properties.visit.enum,
    ['office', 'full-body-exam', 'exam'],
  )
  const tool = (
    await rpc('tools/call', {
      name: 'find_appointments',
      arguments: {
        visit: 'exam',
        days: ['fri'],
        times: ['late-morning'],
        avoid: ['11:00-12:00'],
        limit: 1,
      },
    })
  ).result
  assert.equal(tool.structuredContent.totalMatches, 1)
  assert.match(tool.content[0].text, /10:30 AM/)
  assert.ok(tool.content[0].text.includes(tool.structuredContent.pageUrl))
  const noMatch = (
    await rpc('tools/call', { name: 'find_appointments', arguments: { days: ['sun'] } })
  ).result
  assert.match(noMatch.content[0].text, /Soonest at any time/)
  assert.doesNotMatch(noMatch.content[0].text, /undefined/)
  const office = (await rpc('tools/call', { name: 'get_office_details' }, 200, '?via=webmcp'))
    .result
  assert.equal(office.structuredContent.office.address1, '400 Indiana St #380')
  assert.match(office.content[0].text, /720/)
  assert.equal(
    (await rpc('tools/call', { name: 'find_appointments', arguments: { visit: 'unknown' } })).result
      .isError,
    true,
  )
  assert.deepEqual((await rpc('ping')).result, {})
  assert.equal((await rpc('unknown_method', undefined, 400)).error.code, -32601)
  assert.equal((await rpc('tools/call', { name: 'unknown_tool' }, 400)).error.code, -32601)
  assert.equal((await rpc('tools/call', {}, 400)).error.code, -32602)
  for (const body of ['null', '42', '[]', '[{"method":"ping"}]', '{}', '{"method":1}']) {
    assert.equal((await json('/mcp', 400, { method: 'POST', body })).error.code, -32600)
  }
  assert.equal(
    (await json('/mcp', 400, { method: 'POST', body: '{"jsonrpc":' })).error.code,
    -32700,
  )
  for (const method of ['notifications/initialized', 'notifications/cancelled']) {
    const response = await r.dispatch('/mcp', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', method }),
    })
    assert.equal(response.status, 202)
    assert.equal(await response.text(), '')
  }
  assert.equal((await r.dispatch('/mcp')).status, 405)
  await eventually(
    () => activityRows(r).filter((row) => row.k === 'mcp'),
    (rows) => {
      assert.ok(rows.some((row) => row.tool === 'get_office_details' && row.via === 'webmcp'))
      assert.ok(rows.every((row) => row.tool !== 'unknown_tool'))
    },
  )
  assert.equal(
    r.fixture.requests.length,
    requests,
    'Pages, APIs, and tools reuse the fresh availability cache',
  )
})

test('limited-bodies-and-allowed-events', async (t) => {
  const { runtime: r } = await start(t)
  const human = { 'user-agent': 'Mozilla/5.0 Chrome/130.0', 'cf-connecting-ip': '198.51.100.7' }
  assert.equal((await r.dispatch('/api/events')).status, 405)
  for (const [e, headers] of [
    ['hero_book_page_click', human],
    ['book_page_view', human],
    ['unknown_click', human],
    ['book_page_view', { 'user-agent': 'curl/8.6.0' }],
    ['hero_book_page_click', { 'user-agent': 'ChatGPT-User/1.0' }],
  ])
    assert.equal(
      (await r.dispatch('/api/events', { method: 'POST', headers, body: JSON.stringify({ e }) }))
        .status,
      204,
    )
  for (const body of ['{"e":"book_page_view", "extra":1}', '{"e":"unknown"}', 'invalid'])
    assert.equal(
      (await r.dispatch('/api/events', { method: 'POST', headers: human, body })).status,
      204,
    )
  for (const [path, max] of [
    ['/api/events', 1024],
    ['/mcp', 64 * 1024],
  ]) {
    const declared = await r.dispatch(path, {
      method: 'POST',
      headers: { 'content-length': String(max + 1), connection: 'close' },
      body: 'x'.repeat(max + 1),
    })
    assert.equal(declared.status, 413)
    let sent = 0
    const body = new ReadableStream({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('é'.repeat(256)))
        if (++sent > max / 512 + 4) controller.close()
      },
    })
    const response = await r.dispatch(path, {
      method: 'POST',
      headers: { connection: 'close' },
      body,
      duplex: 'half',
    })
    assert.equal(response.status, 413, path)
  }
  await eventually(
    () => activityRows(r),
    (rows) => {
      assert.deepEqual(rows.map((row) => row.e).sort(), ['book_page_view', 'hero_book_page_click'])
    },
  )
  assert.equal(r.fixture.requests.length, 0)
})
