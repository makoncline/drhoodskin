import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type serverHandler from '../../server'

type SchedulerMode =
  | 'slots'
  | 'phone-only'
  | 'empty'
  | 'unrecognized'
  | 'failed'
  | 'drifted-time'
  | 'drifted-path'
  | 'drifted-origin'
  | 'drifted-url'

const driftedSlotMarkup: Partial<Record<SchedulerMode, string>> = {
  'drifted-time':
    '<a class="nextpatient-slot-time" href="/p/5596/111/appt-book">Morning</a>',
  'drifted-path':
    '<a class="nextpatient-slot-time" href="/booking/111">8:40am</a>',
  'drifted-origin':
    '<a class="nextpatient-slot-time" href="https://example.com/p/5596/111/appt-book">8:40am</a>',
  'drifted-url':
    '<a class="nextpatient-slot-time" href="https://[invalid">8:40am</a>',
}

const site = 'https://drhoodskin.com'
const now = new Date('2026-11-16T07:00:00Z')
const officialCalendar = 'https://nextpatient.co/p/5596/60744/appointments'
const officeSchedule: Record<string, string[]> = {
  '2026-11-16': ['8:40am', '9:00am', '10:00am', '2:00pm'],
  '2026-11-17': ['8:50am', '11:00am'],
  '2026-11-18': ['1:00pm'],
  '2026-11-19': ['8:40am', '2:30pm'],
  '2026-11-20': ['8:40am', '8:50am', '9:30am', '2:50pm'],
  '2026-11-23': ['8:40am', '2:40pm'],
  '2026-11-24': ['8:40am'],
}
const examSchedule: Record<string, string[]> = {
  '2026-11-16': ['2:30pm'],
  '2026-11-20': ['10:30am'],
}

let server: typeof serverHandler
let scheduler: { office: SchedulerMode; exam: SchedulerMode }
let schedulerFetch: ReturnType<typeof vi.fn<typeof fetch>>
const logDirs: string[] = []

function activityLogFile() {
  const dir = mkdtempSync(join(tmpdir(), 'activity-server-'))
  logDirs.push(dir)
  vi.stubEnv('LOG_DIR', dir)
  return join(dir, `activity-${now.toISOString().slice(0, 10)}.jsonl`)
}

function schedulerWindow(day: string, reason: string) {
  const schedule = reason === '56487' ? officeSchedule : examSchedule
  const cells = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(`${day}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + index)
    const isoDate = date.toISOString().slice(0, 10)
    const links = (schedule[isoDate] ?? []).map(
      (time, slot) =>
        `<a class="nextpatient-slot-time" href="/p/5596/${reason}${isoDate.replaceAll('-', '')}${slot}/appt-book?reason_id=${reason}">${time}</a>`,
    )
    return `<td class="nextpatient-schedule-day-slots">${links.join('')}</td>`
  })
  return `<table><tr>${cells.join('')}</tr></table>`
}

function appointments(query = '') {
  return server.fetch(new Request(`${site}/api/appointments${query}`))
}

function postMcp(body: string) {
  return server.fetch(
    new Request(`${site}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }),
  )
}

function rpc(method: string, params?: Record<string, unknown>, id = 1) {
  return postMcp(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
}

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.stubEnv('LOG_DIR', '')
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  scheduler = { office: 'slots', exam: 'slots' }
  schedulerFetch = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const reason = url.searchParams.get('reason_id')
    const day = url.searchParams.get('day')
    if (
      url.origin !== 'https://nextpatient.co' ||
      url.pathname !== '/p/5596/schedule.json' ||
      url.searchParams.get('entity_id') !== '60744' ||
      !day ||
      (reason !== '56487' && reason !== '56485')
    ) {
      throw new Error(`Unexpected external request: ${url}`)
    }
    const mode = reason === '56487' ? scheduler.office : scheduler.exam
    if (mode === 'failed') return new Response(null, { status: 503 })
    const html =
      mode === 'slots'
        ? schedulerWindow(day, reason)
        : mode === 'phone-only'
          ? '<p>Please call to schedule</p>'
          : mode === 'empty'
            ? '<table><tr><td class="nextpatient-schedule-day-slots nextpatient-schedule-next-available" colspan="3">No times available</td></tr></table>'
            : driftedSlotMarkup[mode]
              ? `<table><tr><td class="nextpatient-schedule-day-slots">${driftedSlotMarkup[mode]}</td></tr></table>`
              : '<p>Down for maintenance</p>'
    return new Response(JSON.stringify({ html, day, next_slot_day: '' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', schedulerFetch)
  server = (await import('../../server')).default
})

afterEach(async () => {
  await vi.advanceTimersByTimeAsync(0)
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  for (const dir of logDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe.each([
  ['/api/events', 1024],
  ['/mcp', 64 * 1024],
] as const)('POST %s body limit', (path, maxBytes) => {
  it('rejects an oversized Content-Length before parsing the body', async () => {
    const response = await server.fetch(
      new Request(`${site}${path}`, {
        method: 'POST',
        headers: { 'Content-Length': String(maxBytes + 1) },
        body: '{}',
      }),
    )
    expect(response.status).toBe(413)
    expect(schedulerFetch).not.toHaveBeenCalled()
  })

  it.each([undefined, '1'])(
    'stops an oversized stream with Content-Length=%s',
    async (contentLength) => {
      let cancelled = false
      let chunks = 0
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          chunks += 1
          controller.enqueue(new TextEncoder().encode('é'.repeat(256)))
        },
        cancel() {
          cancelled = true
        },
      })
      const request = new Request(`${site}${path}`, {
        method: 'POST',
        headers:
          contentLength === undefined
            ? {}
            : { 'Content-Length': contentLength },
        body,
        duplex: 'half',
      } as RequestInit)
      const response = await server.fetch(request)
      expect(response.status).toBe(413)
      expect(cancelled).toBe(true)
      expect(chunks).toBeLessThanOrEqual(maxBytes / 512 + 2)
      expect(schedulerFetch).not.toHaveBeenCalled()
    },
  )
})

describe('POST /api/events', () => {
  it('persists only known events from people', async () => {
    const file = activityLogFile()
    for (const [name, userAgent] of [
      ['hero_book_page_click', 'Mozilla/5.0 Chrome/130.0'],
      ['book_page_view', 'Mozilla/5.0 Chrome/130.0'],
      ['unknown_click', 'Mozilla/5.0 Chrome/130.0'],
      ['hero_book_page_click', 'curl/8.6.0'],
      ['book_page_view', 'curl/8.6.0'],
    ]) {
      const response = await server.fetch(
        new Request(`${site}/api/events`, {
          method: 'POST',
          headers: { 'User-Agent': userAgent },
          body: JSON.stringify({ e: name }),
        }),
      )
      expect(response.status).toBe(204)
    }
    const entries = readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(entries).toEqual([
      expect.objectContaining({
        k: 'event',
        a: 'human',
        e: 'hero_book_page_click',
      }),
      expect.objectContaining({
        k: 'event',
        a: 'human',
        e: 'book_page_view',
      }),
    ])
    expect(schedulerFetch).not.toHaveBeenCalled()
  })
})

describe('GET /api/appointments', () => {
  it('returns office times by default with booking links and the other visit type', async () => {
    const response = await appointments()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    const result = JSON.parse(await response.text())
    expect(result).toMatchObject({
      visit: 'office',
      timeZone: 'America/Denver',
      checkedAt: now.toISOString(),
      status: 'open',
      message: null,
      totalMatches: 16,
      totalDays: 7,
      officialCalendar,
      pageUrl: `${site}/book`,
      soonest: {
        date: '2026-11-16',
        weekday: 'Monday',
        time: '8:40 AM',
        start: '2026-11-16T08:40:00-07:00',
        waitDays: 0,
      },
      otherVisit: {
        visit: 'full-body-exam',
        status: 'open',
        soonest: { date: '2026-11-16', time: '2:30 PM' },
      },
    })
    expect(result.days).toHaveLength(5)
    expect(result.days[0]).toMatchObject({
      date: '2026-11-16',
      weekday: 'Monday',
      waitDays: 0,
      times: [
        {
          time: '8:40 AM',
          start: '2026-11-16T08:40:00-07:00',
          bookingUrl:
            'https://nextpatient.co/p/5596/56487202611160/appt-book?reason_id=56487',
        },
        { time: '9:00 AM' },
        { time: '10:00 AM' },
        { time: '2:00 PM' },
      ],
    })
    expect(result.instructions).toContain(
      'Never offer an office-visit time for a full-body exam',
    )
  })

  it.each(['full-body-exam', 'exam'])(
    'returns full-body exam slots for visit=%s without substituting office times',
    async (visit) => {
      const response = await appointments(`?visit=${visit}`)
      expect(response.status).toBe(200)
      const result = JSON.parse(await response.text())
      expect(result).toMatchObject({
        visit: 'full-body-exam',
        status: 'open',
        pageUrl: `${site}/book?visit=exam`,
        totalMatches: 2,
        totalDays: 2,
        days: [
          {
            date: '2026-11-16',
            times: [
              {
                time: '2:30 PM',
                start: '2026-11-16T14:30:00-07:00',
                bookingUrl:
                  'https://nextpatient.co/p/5596/56485202611160/appt-book?reason_id=56485',
              },
            ],
          },
          { date: '2026-11-20', times: [{ time: '10:30 AM' }] },
        ],
        otherVisit: {
          visit: 'office',
          status: 'open',
          soonest: { time: '8:40 AM' },
        },
      })
    },
  )

  it.each(['office', ''])(
    'returns office times for visit=%s',
    async (visit) => {
      const response = await appointments(`?visit=${visit}`)
      expect(response.status).toBe(200)
      expect(JSON.parse(await response.text())).toMatchObject({
        visit: 'office',
        totalMatches: 16,
        soonest: { time: '8:40 AM' },
      })
    },
  )

  it('rejects an invalid visit instead of returning office times', async () => {
    const response = await appointments('?visit=unknown')
    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(JSON.parse(await response.text())).toEqual({
      error: 'Invalid visit. Use office, full-body-exam, or exam.',
    })
  })

  it('combines weekday, time-band, and busy-range filters and limits days, not times', async () => {
    const query = new URLSearchParams({
      days: 'mon,fri',
      times: 'early-morning,late-afternoon',
      avoid: '08:50-09:30,14:00-14:50',
      limit: '2',
    })
    const response = await appointments(`?${query}`)
    expect(response.status).toBe(200)
    const result = JSON.parse(await response.text())
    expect(result).toMatchObject({
      filter: {
        days: ['mon', 'fri'],
        times: ['early-morning', 'late-afternoon'],
      },
      totalMatches: 5,
      totalDays: 3,
      days: [
        { date: '2026-11-16', times: [{ time: '8:40 AM' }] },
        {
          date: '2026-11-20',
          times: [
            { time: '8:40 AM' },
            { time: '9:30 AM' },
            { time: '2:50 PM' },
          ],
        },
      ],
      otherVisit: { soonest: { time: '2:30 PM' } },
    })
    const page = new URL(result.pageUrl)
    expect(`${page.origin}${page.pathname}`).toBe(`${site}/book`)
    expect(Object.fromEntries(page.searchParams)).toEqual({
      days: 'mon,fri',
      times: 'early-morning,late-afternoon',
      avoid: '08:50-09:30,14:00-14:50',
    })
  })

  it('combines repeated weekday, time-band, and busy-range query keys', async () => {
    const response = await appointments(
      '?days=mon&days=fri&times=early-morning&times=late-afternoon&avoid=08:50-09:30&avoid=14:00-14:50',
    )
    expect(response.status).toBe(200)
    const result = JSON.parse(await response.text())
    expect(result).toMatchObject({
      filter: {
        days: ['mon', 'fri'],
        times: ['early-morning', 'late-afternoon'],
      },
      totalMatches: 5,
      totalDays: 3,
      days: [
        { date: '2026-11-16', times: [{ time: '8:40 AM' }] },
        {
          date: '2026-11-20',
          times: [
            { time: '8:40 AM' },
            { time: '9:30 AM' },
            { time: '2:50 PM' },
          ],
        },
        { date: '2026-11-23', times: [{ time: '8:40 AM' }] },
      ],
    })
    const commaSeparated = await appointments(
      '?days=mon,fri&times=early-morning,late-afternoon&avoid=08:50-09:30,14:00-14:50',
    )
    expect(commaSeparated.status).toBe(200)
    expect(JSON.parse(await commaSeparated.text())).toEqual(result)
  })

  it.each([
    ['office', undefined, '2026-11-16', '10:00 AM'],
    ['full-body-exam', 'exam', '2026-11-20', '10:30 AM'],
  ])(
    'preserves the visit and filters through pageUrl for %s',
    async (visit, pageVisit, date, time) => {
      const response = await appointments(
        `?visit=${visit}&days=mon,fri&times=late-morning,late-afternoon&avoid=14:00-15:00,11:00-12:00`,
      )
      expect(response.status).toBe(200)
      const result = JSON.parse(await response.text())
      expect(result).toMatchObject({
        visit,
        filter: {
          days: ['mon', 'fri'],
          times: ['late-morning', 'late-afternoon'],
        },
        totalMatches: 1,
        days: [{ date, times: [{ time }] }],
      })
      const page = new URL(result.pageUrl)
      expect(`${page.origin}${page.pathname}`).toBe(`${site}/book`)
      expect(Object.fromEntries(page.searchParams)).toEqual({
        ...(pageVisit ? { visit: pageVisit } : {}),
        days: 'mon,fri',
        times: 'late-morning,late-afternoon',
        avoid: '14:00-15:00,11:00-12:00',
      })
      const roundTrip = await appointments(page.search)
      expect(roundTrip.status).toBe(200)
      expect(JSON.parse(await roundTrip.text())).toEqual(result)
    },
  )

  it.each([
    ['0', 1],
    ['not-a-number', 5],
  ])('handles limit=%s with %i matching days', async (limit, count) => {
    const response = await appointments(`?limit=${limit}`)
    expect(response.status).toBe(200)
    const result = JSON.parse(await response.text())
    expect(result.days).toHaveLength(count)
    expect(result.totalMatches).toBe(16)
    expect(result.totalDays).toBe(7)
  })

  it('keeps the unfiltered soonest time when no times fit the filters', async () => {
    const response = await appointments('?days=sun')
    expect(response.status).toBe(200)
    expect(JSON.parse(await response.text())).toMatchObject({
      status: 'open',
      days: [],
      totalMatches: 0,
      totalDays: 0,
      soonest: { date: '2026-11-16', time: '8:40 AM' },
    })
  })

  it.each(['phone-only', 'empty'] as const)(
    'provides call guidance for a recognized %s schedule',
    async (mode) => {
      scheduler.office = mode
      const response = await appointments()
      expect(response.status).toBe(200)
      const result = JSON.parse(await response.text())
      expect(result).toMatchObject({
        status: 'call-to-schedule',
        days: [],
        totalMatches: 0,
        totalDays: 0,
        soonest: null,
        call: { phone: '(720) 604-0602', phoneHref: 'tel:+17206040602' },
        otherVisit: { status: 'open' },
      })
      expect(result.message).toContain('Call (720) 604-0602')
    },
  )

  it('returns a 502 JSON fallback for an unrecognized scheduler response', async () => {
    scheduler.office = 'unrecognized'
    const response = await appointments()
    expect(response.status).toBe(502)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(JSON.parse(await response.text())).toEqual({
      error: 'Open times could not be loaded.',
      officialCalendar,
      phone: '(720) 604-0602',
    })
  })

  it.each([
    'drifted-time',
    'drifted-path',
    'drifted-origin',
    'drifted-url',
  ] as const)(
    'returns 502 instead of call guidance for %s slot markup',
    async (mode) => {
      scheduler.office = mode
      const response = await appointments()
      expect(response.status).toBe(502)
      expect(JSON.parse(await response.text())).toEqual({
        error: 'Open times could not be loaded.',
        officialCalendar,
        phone: '(720) 604-0602',
      })
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        '[availability] office: Unrecognized scheduler slots',
      )
    },
  )

  it('still returns office times when only the other visit cannot be loaded', async () => {
    scheduler.exam = 'failed'
    const response = await appointments()
    expect(response.status).toBe(200)
    expect(JSON.parse(await response.text())).toMatchObject({
      visit: 'office',
      status: 'open',
      totalMatches: 16,
      otherVisit: {
        visit: 'full-body-exam',
        status: 'unknown',
        soonest: null,
      },
    })
  })
})

describe('POST /mcp', () => {
  it('initializes the read-only tool server with the request id', async () => {
    const response = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'patient-assistant', version: '1.0.0' },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('mcp-protocol-version')).toBe('2025-06-18')
    expect(JSON.parse(await response.text())).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'drhoodskin-mcp', version: '1.0.0' },
        instructions: expect.stringContaining('read-only'),
      },
    })
    expect(schedulerFetch).not.toHaveBeenCalled()
  })

  it('lists appointment and site tools with their public input schemas', async () => {
    const response = await rpc('tools/list', undefined, 2)
    expect(response.status).toBe(200)
    const body = JSON.parse(await response.text())
    expect(body).toMatchObject({ jsonrpc: '2.0', id: 2 })
    expect(body.result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'find_appointments',
          annotations: expect.objectContaining({ readOnlyHint: true }),
          inputSchema: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              visit: expect.objectContaining({
                enum: ['office', 'full-body-exam', 'exam'],
              }),
              days: expect.objectContaining({ type: 'array' }),
              times: expect.objectContaining({ type: 'array' }),
              avoid: expect.objectContaining({ type: 'array' }),
              limit: expect.objectContaining({ minimum: 1, maximum: 20 }),
            }),
          }),
        }),
        expect.objectContaining({ name: 'get_office_details' }),
      ]),
    )
    expect(schedulerFetch).not.toHaveBeenCalled()
  })

  it('finds exam appointments with matching text, structured data, and patient links', async () => {
    const response = await rpc(
      'tools/call',
      {
        name: 'find_appointments',
        arguments: {
          visit: 'exam',
          days: ['fri'],
          times: ['late-morning'],
          avoid: ['11:00-12:00'],
          limit: 1,
        },
      },
      3,
    )
    expect(response.status).toBe(200)
    const body = JSON.parse(await response.text())
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      result: {
        content: [{ type: 'text' }],
        structuredContent: {
          visit: 'full-body-exam',
          status: 'open',
          totalMatches: 1,
          totalDays: 1,
          days: [{ date: '2026-11-20', times: [{ time: '10:30 AM' }] }],
        },
      },
    })
    const result = body.result
    expect(result.isError).not.toBe(true)
    const text = result.content[0].text
    expect(text).toContain('1 open times across 1 days fit')
    expect(text).toContain('Friday, 2026-11-20: 10:30 AM:')
    expect(text).toContain(result.structuredContent.days[0].times[0].bookingUrl)
    expect(text).toContain(result.structuredContent.pageUrl)
    expect(text).toContain('Mountain Time')
    expect(text).toContain(
      'A full-body skin exam needs a full-body slot. Never offer an office-visit time for a full-body exam.',
    )
  })

  it('returns a tool input error for an invalid appointment visit', async () => {
    const response = await rpc('tools/call', {
      name: 'find_appointments',
      arguments: { visit: 'unknown' },
    })
    expect(response.status).toBe(200)
    expect(JSON.parse(await response.text())).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Invalid visit. Use office, full-body-exam, or exam.',
          },
        ],
      },
    })
  })

  it('returns office details in text and structured content without a scheduler request', async () => {
    const response = await rpc('tools/call', {
      name: 'get_office_details',
      arguments: {},
    })
    expect(response.status).toBe(200)
    const body = JSON.parse(await response.text())
    expect(body.result).toMatchObject({
      content: [
        {
          type: 'text',
          text: expect.stringContaining('400 Indiana St #380'),
        },
      ],
      structuredContent: {
        office: {
          name: 'U.S. Dermatology Partners Golden',
          address1: '400 Indiana St #380',
          city: 'Golden',
          phoneDisplay: '(720) 604-0602',
        },
      },
    })
    expect(body.result.content[0].text).toContain('(720) 604-0602')
    expect(schedulerFetch).not.toHaveBeenCalled()
  })

  it('returns a JSON-RPC error for an unknown tool', async () => {
    const response = await rpc('tools/call', { name: 'unknown_tool' }, 4)
    expect(response.status).toBe(400)
    expect(JSON.parse(await response.text())).toEqual({
      jsonrpc: '2.0',
      id: 4,
      error: { code: -32601, message: 'Unknown tool: unknown_tool' },
    })
    expect(schedulerFetch).not.toHaveBeenCalled()
  })

  it('does not persist unknown tool names', async () => {
    const file = activityLogFile()
    expect(
      (await rpc('tools/call', { name: 'get_office_details' })).status,
    ).toBe(200)
    const unknownTool = `unknown_tool_${'x'.repeat(4096)}`
    const response = await rpc('tools/call', { name: unknownTool }, 4)
    expect(response.status).toBe(400)
    expect(JSON.parse(await response.text())).toEqual({
      jsonrpc: '2.0',
      id: 4,
      error: { code: -32601, message: `Unknown tool: ${unknownTool}` },
    })
    const log = readFileSync(file, 'utf8')
    expect(log).not.toContain(unknownTool)
    const entries = log
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(entries).toEqual([
      expect.objectContaining({ k: 'mcp', tool: 'get_office_details' }),
    ])
    expect(schedulerFetch).not.toHaveBeenCalled()
  })

  it.each(['null', '42', '[]', '[{"method":"ping"}]', '{}', '{"method":1}'])(
    'returns invalid request -32600 for %s',
    async (body) => {
      const response = await postMcp(body)
      expect(response.status).toBe(400)
      expect(JSON.parse(await response.text())).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid Request' },
      })
      expect(schedulerFetch).not.toHaveBeenCalled()
    },
  )

  it('returns parse error -32700 for invalid JSON', async () => {
    const response = await postMcp('{"jsonrpc":')
    expect(response.status).toBe(400)
    expect(JSON.parse(await response.text())).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Invalid JSON request body' },
    })
    expect(schedulerFetch).not.toHaveBeenCalled()
  })

  it.each(['notifications/initialized', 'notifications/cancelled'])(
    'accepts %s with an empty 202 response',
    async (method) => {
      const response = await postMcp(JSON.stringify({ jsonrpc: '2.0', method }))
      expect(response.status).toBe(202)
      expect(await response.text()).toBe('')
      expect(schedulerFetch).not.toHaveBeenCalled()
    },
  )
})

describe('availability cache through GET /api/appointments', () => {
  it('reuses fresh entries without another scheduler request', async () => {
    const initial = await appointments()
    expect(initial.status).toBe(200)
    const first = JSON.parse(await initial.text())
    const requests = schedulerFetch.mock.calls.length
    expect(requests).toBeGreaterThan(0)
    scheduler.office = 'failed'
    scheduler.exam = 'failed'
    await vi.advanceTimersByTimeAsync(119_999)

    const response = await appointments()
    expect(response.status).toBe(200)
    expect(JSON.parse(await response.text())).toEqual(first)
    expect(schedulerFetch).toHaveBeenCalledTimes(requests)
  })

  it('keeps serving stale entries after background refreshes fail', async () => {
    const initial = await appointments()
    expect(initial.status).toBe(200)
    const first = JSON.parse(await initial.text())
    const requests = schedulerFetch.mock.calls.length
    scheduler.office = 'failed'
    scheduler.exam = 'failed'
    await vi.advanceTimersByTimeAsync(120_000)

    const stale = await appointments()
    expect(stale.status).toBe(200)
    expect(JSON.parse(await stale.text())).toEqual(first)
    await vi.advanceTimersByTimeAsync(0)
    expect(schedulerFetch).toHaveBeenCalledTimes(requests + 2)
    expect(console.error).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith(
      '[availability] office: Schedule request failed (503)',
    )
    expect(console.error).toHaveBeenCalledWith(
      '[availability] full-body-exam: Schedule request failed (503)',
    )
    await vi.advanceTimersByTimeAsync(59_999)

    const retry = await appointments()
    expect(retry.status).toBe(200)
    expect(JSON.parse(await retry.text())).toEqual(first)
    await vi.advanceTimersByTimeAsync(0)
    expect(schedulerFetch).toHaveBeenCalledTimes(requests + 2)
    expect(console.error).toHaveBeenCalledTimes(2)
  })

  it('returns an error when a failed refresh has no cached entry to use', async () => {
    scheduler.office = 'failed'
    scheduler.exam = 'failed'
    const response = await appointments()
    expect(response.status).toBe(502)
    expect(JSON.parse(await response.text())).toEqual({
      error: 'Open times could not be loaded.',
      officialCalendar,
      phone: '(720) 604-0602',
    })
  })

  it('backs off without cached data, doubles the delay, and resets after recovery', async () => {
    scheduler.office = 'failed'
    scheduler.exam = 'failed'
    expect((await appointments()).status).toBe(502)
    await vi.advanceTimersByTimeAsync(0)
    expect(schedulerFetch).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(59_999)
    const blocked = await appointments()
    expect(blocked.status).toBe(502)
    expect(JSON.parse(await blocked.text())).toMatchObject({
      error: 'Open times could not be loaded.',
      officialCalendar,
    })
    expect(schedulerFetch).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledTimes(2)
    const toolResponse = await rpc('tools/call', {
      name: 'find_appointments',
      arguments: {},
    })
    expect(toolResponse.status).toBe(200)
    expect(JSON.parse(await toolResponse.text())).toMatchObject({
      result: { isError: true },
    })
    expect(schedulerFetch).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)
    expect((await appointments()).status).toBe(502)
    await vi.advanceTimersByTimeAsync(0)
    expect(schedulerFetch).toHaveBeenCalledTimes(4)
    expect(console.error).toHaveBeenCalledTimes(4)

    await vi.advanceTimersByTimeAsync(119_999)
    expect((await appointments()).status).toBe(502)
    expect(schedulerFetch).toHaveBeenCalledTimes(4)
    expect(console.error).toHaveBeenCalledTimes(4)

    scheduler.office = 'slots'
    scheduler.exam = 'slots'
    await vi.advanceTimersByTimeAsync(1)
    const recovered = await appointments()
    expect(recovered.status).toBe(200)
    const recoveredData = JSON.parse(await recovered.text())
    expect(recoveredData).toMatchObject({
      status: 'open',
      checkedAt: new Date(now.getTime() + 180_000).toISOString(),
      totalMatches: 16,
      otherVisit: { status: 'open' },
    })
    const requests = schedulerFetch.mock.calls.length
    expect(requests).toBeGreaterThan(4)

    scheduler.office = 'failed'
    scheduler.exam = 'failed'
    await vi.advanceTimersByTimeAsync(120_000)
    const stale = await appointments()
    expect(stale.status).toBe(200)
    expect(JSON.parse(await stale.text())).toEqual(recoveredData)
    await vi.advanceTimersByTimeAsync(0)
    expect(schedulerFetch).toHaveBeenCalledTimes(requests + 2)
    expect(console.error).toHaveBeenCalledTimes(6)

    await vi.advanceTimersByTimeAsync(59_999)
    expect((await appointments()).status).toBe(200)
    expect(schedulerFetch).toHaveBeenCalledTimes(requests + 2)

    scheduler.office = 'slots'
    scheduler.exam = 'slots'
    await vi.advanceTimersByTimeAsync(1)
    expect((await appointments()).status).toBe(200)
    await vi.advanceTimersByTimeAsync(0)
    expect(schedulerFetch.mock.calls.length).toBeGreaterThan(requests + 2)
    const refreshed = await appointments()
    expect(refreshed.status).toBe(200)
    expect(JSON.parse(await refreshed.text())).toMatchObject({
      status: 'open',
      checkedAt: new Date(now.getTime() + 360_000).toISOString(),
      totalMatches: 16,
    })
    expect(console.error).toHaveBeenCalledTimes(6)
  })

  it('caps backoff at 15 minutes without blocking the other visit', async () => {
    scheduler.office = 'failed'
    scheduler.exam = 'empty'
    const officeRequests = () =>
      schedulerFetch.mock.calls.filter(([input]) =>
        String(input).includes('reason_id=56487'),
      ).length
    expect((await appointments('?visit=exam')).status).toBe(200)
    let attempts = 1

    for (const delay of [60_000, 120_000, 240_000, 480_000, 900_000, 900_000]) {
      await vi.advanceTimersByTimeAsync(delay - 1)
      const blocked = await appointments('?visit=exam')
      expect(blocked.status).toBe(200)
      expect(JSON.parse(await blocked.text())).toMatchObject({
        visit: 'full-body-exam',
        status: 'call-to-schedule',
        otherVisit: { status: 'unknown' },
      })
      expect(officeRequests()).toBe(attempts)
      expect(console.error).toHaveBeenCalledTimes(attempts)

      await vi.advanceTimersByTimeAsync(1)
      expect((await appointments('?visit=exam')).status).toBe(200)
      attempts += 1
      expect(officeRequests()).toBe(attempts)
      expect(console.error).toHaveBeenCalledTimes(attempts)
    }
  })

  it('returns an error when cached entries have reached the stale limit and refresh fails', async () => {
    const initial = await appointments()
    expect(initial.status).toBe(200)
    scheduler.office = 'failed'
    scheduler.exam = 'failed'
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)

    const response = await appointments()
    expect(response.status).toBe(502)
    expect(JSON.parse(await response.text())).toMatchObject({
      error: 'Open times could not be loaded.',
      officialCalendar,
    })
    await vi.advanceTimersByTimeAsync(0)
    const requests = schedulerFetch.mock.calls.length
    expect((await appointments()).status).toBe(502)
    expect(schedulerFetch).toHaveBeenCalledTimes(requests)
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})
