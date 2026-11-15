import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyAgent, requestContext, writeActivity } from './activityLog.ts'
import { readActivity, summarizeActivity } from './activityReport.ts'

const dirs: string[] = []
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

function headers(
  userAgent: string,
  ip = '203.0.113.7',
  extra: Record<string, string> = {},
) {
  return new Headers({
    'user-agent': userAgent,
    'cf-connecting-ip': ip,
    'cf-ipcountry': 'US',
    ...extra,
  })
}

describe('activity log and report', () => {
  it('counts persisted scheduler visits without counting booking-page navigation', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const dir = mkdtempSync(join(tmpdir(), 'activity-'))
    dirs.push(dir)
    const visits = [
      [
        'hero_schedule_click',
        'closing_schedule_click',
        'header_schedule_click',
        'sticky_schedule_click',
      ],
      [
        'hero_book_page_click',
        'closing_book_page_click',
        'header_book_page_click',
        'sticky_book_page_click',
      ],
      [
        'hero_scheduler_click',
        'book_schedule_click',
        'book_early_schedule_click',
      ],
    ]
    for (const [index, events] of visits.entries()) {
      const context = requestContext(
        headers('Mozilla/5.0 Chrome/130.0', `198.51.100.${index + 1}`),
        'drhoodskin.com',
      )
      writeActivity({ ...context, k: 'request', p: '/' }, dir)
      for (const event of events) {
        writeActivity({ ...context, k: 'event', p: '/', e: event }, dir)
      }
    }
    const summary = summarizeActivity(readActivity(dir, 1))
    expect(summary.booking.schedule).toBe(7)
    expect(summary.visitorDays).toBe(3)
    expect(summary.bookingVisitorDays).toBe(2)
    expect(summary.bookingRate).toBeCloseTo(2 / 3)
    expect(summary.clicksByEvent).toContainEqual(['hero_book_page_click', 1])
  })

  it('includes direct booking-page visitors in the booking rate', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const dir = mkdtempSync(join(tmpdir(), 'activity-'))
    dirs.push(dir)
    for (const [index, path] of ['/', '/book'].entries()) {
      const context = requestContext(
        headers('Mozilla/5.0 Chrome/130.0', `198.51.100.${index + 1}`),
        'drhoodskin.com',
      )
      writeActivity({ ...context, k: 'request', p: path }, dir)
      writeActivity(
        { ...context, k: 'event', p: '/', e: 'book_schedule_click' },
        dir,
      )
    }

    const summary = summarizeActivity(readActivity(dir, 1))
    expect(summary.pageViews).toBe(1)
    expect(summary.bookPageViews).toBe(1)
    expect(summary.visitorDays).toBe(2)
    expect(summary.bookingVisitorDays).toBe(2)
    expect(summary.bookingRate).toBe(1)
  })

  it('counts client booking-page arrivals and full loads once each', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const dir = mkdtempSync(join(tmpdir(), 'activity-'))
    dirs.push(dir)
    const navigation = requestContext(
      headers('Mozilla/5.0 Chrome/130.0', '198.51.100.1'),
      'drhoodskin.com',
    )
    writeActivity({ ...navigation, k: 'request', p: '/' }, dir)
    for (const event of ['hero_book_page_click', 'book_page_view']) {
      writeActivity({ ...navigation, k: 'event', p: '/', e: event }, dir)
    }
    const fullLoad = requestContext(
      headers('Mozilla/5.0 Chrome/130.0', '198.51.100.2'),
      'drhoodskin.com',
    )
    writeActivity({ ...fullLoad, k: 'request', p: '/book' }, dir)

    const summary = summarizeActivity(readActivity(dir, 1))
    expect(summary.bookPageViews).toBe(2)
    expect(summary.pageViews).toBe(1)
    expect(summary.visitorDays).toBe(2)
    expect(summary.booking).toEqual({ schedule: 0, callback: 0, call: 0 })
    expect(summary.bookingVisitorDays).toBe(0)
    expect(summary.bookingRate).toBe(0)
  })

  it.each([
    ['2026-11-21', '2026-11-22T07:00:00Z'],
    ['2026-07-21', '2026-07-22T06:00:00Z'],
  ])('keeps the Denver evening on %s in one visitor-day', (day, midnight) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.useFakeTimers()
    const dir = mkdtempSync(join(tmpdir(), 'activity-'))
    dirs.push(dir)
    const evening = new Date(`${day}T23:30:00Z`)
    const later = new Date(evening.getTime() + 3.5 * 60 * 60_000)
    for (const time of [evening, later]) {
      vi.setSystemTime(time)
      const context = requestContext(
        headers('Mozilla/5.0 Chrome/130.0'),
        'drhoodskin.com',
      )
      writeActivity({ ...context, k: 'request', p: '/book' }, dir)
      writeActivity(
        { ...context, k: 'event', p: '/', e: 'book_schedule_click' },
        dir,
      )
    }

    const entries = readActivity(dir, 1)
    expect(entries[0].t).toBe(evening.toISOString())
    expect(entries[2].t).toBe(later.toISOString())
    expect(entries[0].v).toBe(entries[2].v)
    const summary = summarizeActivity(entries)
    expect(summary.visitorDays).toBe(1)
    expect(summary.visitorsByDay).toEqual([[day, 1]])
    expect(summary.bookingVisitorDays).toBe(1)
    expect(summary.bookingRate).toBe(1)

    vi.setSystemTime(new Date(midnight))
    writeActivity(
      {
        ...requestContext(
          headers('Mozilla/5.0 Chrome/130.0'),
          'drhoodskin.com',
        ),
        k: 'request',
        p: '/book',
      },
      dir,
    )
    const nextDayEntries = readActivity(dir, 1)
    expect(nextDayEntries.at(-1)?.v).not.toBe(entries[0].v)
    expect(summarizeActivity(nextDayEntries).visitorDays).toBe(2)
  })

  it('classifies people, AI agents, search bots, and scripts', () => {
    expect(
      classifyAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1').a,
    ).toBe('human')
    expect(
      classifyAgent(
        'Mozilla/5.0; compatible; ChatGPT-User/1.0; +https://openai.com/bot',
      ),
    ).toEqual({
      a: 'ai-agent',
      an: 'ChatGPT-User',
    })
    expect(classifyAgent('Mozilla/5.0 (compatible; Googlebot/2.1)').an).toBe(
      'Googlebot',
    )
    expect(classifyAgent('curl/8.6.0').a).toBe('other-bot')
  })

  it('stores no IP address and summarizes visits, booking actions, and agent use', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const dir = mkdtempSync(join(tmpdir(), 'activity-'))
    dirs.push(dir)
    const phone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1'
    const laptop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) Chrome/130.0'
    const google = { referer: 'https://www.google.com/' }

    writeActivity(
      {
        ...requestContext(
          headers(phone, '198.51.100.1', google),
          'drhoodskin.com',
        ),
        k: 'request',
        p: '/',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers(phone, '198.51.100.1'), 'drhoodskin.com'),
        k: 'request',
        p: '/',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers(phone, '198.51.100.1'), 'drhoodskin.com'),
        k: 'event',
        p: '/',
        e: 'hero_scheduler_click',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers(laptop, '198.51.100.2'), 'drhoodskin.com'),
        k: 'request',
        p: '/',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers(laptop, '198.51.100.2'), 'drhoodskin.com'),
        k: 'event',
        p: '/',
        e: 'visit_call_click',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers(laptop, '198.51.100.2'), 'drhoodskin.com'),
        k: 'request',
        p: '/book',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers(laptop, '198.51.100.2'), 'drhoodskin.com'),
        k: 'event',
        p: '/',
        e: 'book_early_schedule_click',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers('ChatGPT-User/1.0'), 'drhoodskin.com'),
        k: 'request',
        p: '/llms.txt',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers('Claude-User/1.0'), 'drhoodskin.com'),
        k: 'mcp',
        p: '/mcp',
        tool: 'get_booking_options',
      },
      dir,
    )
    writeActivity(
      {
        ...requestContext(headers(laptop, '198.51.100.2'), 'drhoodskin.com'),
        k: 'mcp',
        p: '/mcp',
        tool: 'get_faq',
        via: 'webmcp',
      },
      dir,
    )

    const entries = readActivity(dir, 1)
    expect(JSON.stringify(entries)).not.toContain('198.51.100')
    const summary = summarizeActivity(entries)
    expect(summary.pageViews).toBe(3)
    expect(summary.visitorDays).toBe(2)
    expect(summary.bookPageViews).toBe(1)
    expect(summary.booking).toEqual({ schedule: 2, callback: 0, call: 1 })
    expect(summary.bookingVisitorDays).toBe(2)
    expect(summary.referrers).toEqual([['www.google.com', 1]])
    expect(summary.aiAgents).toEqual([
      ['ChatGPT-User', 1],
      ['Claude-User', 1],
    ])
    expect(summary.mcpTools).toEqual([
      ['get_booking_options', 1],
      ['get_faq (WebMCP)', 1],
    ])
  })
})
