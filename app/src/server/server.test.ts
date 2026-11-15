import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type serverHandler from '../../server'

type SchedulerMode =
  'slots' | 'phone-only' | 'empty' | 'unrecognized' | 'failed'

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

  it('returns full-body exam slots without substituting office times', async () => {
    const response = await appointments('?visit=full-body-exam')
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
                enum: ['office', 'full-body-exam'],
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

  it('finds appointments with matching text, structured data, and patient links', async () => {
    const response = await rpc(
      'tools/call',
      {
        name: 'find_appointments',
        arguments: {
          visit: 'full-body-exam',
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
    expect(response.status).toBe(404)
    expect(JSON.parse(await response.text())).toEqual({
      jsonrpc: '2.0',
      id: 4,
      error: { code: -32601, message: 'Unknown tool: unknown_tool' },
    })
    expect(schedulerFetch).not.toHaveBeenCalled()
  })

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
    await vi.advanceTimersByTimeAsync(1)
    expect(schedulerFetch).toHaveBeenCalledTimes(requests + 2)

    const retry = await appointments()
    expect(retry.status).toBe(200)
    expect(JSON.parse(await retry.text())).toEqual(first)
    await vi.advanceTimersByTimeAsync(1)
    expect(schedulerFetch).toHaveBeenCalledTimes(requests + 4)
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
  })
})
