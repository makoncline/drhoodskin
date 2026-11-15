import { describe, expect, it } from 'vite-plus/test'
import { activityDay, classifyAgent } from '../lib/activity'
import type { ActivityEntry } from '../lib/activity'
import { formatActivityReport, readActivityRows, summarizeActivity } from './activityReport'

const time = '2026-11-21T23:30:00.000Z'
const entry = (v: string, details: Partial<ActivityEntry> = {}): ActivityEntry => ({
  t: time,
  k: 'request',
  p: '/',
  a: 'human',
  v,
  ...details,
})
const event = (v: string, e: string, t = time) => entry(v, { k: 'event', e, t })

describe('activity reports from exported rows', () => {
  it('counts scheduler visits, not booking-page navigation', () => {
    const entries = [entry('a'), entry('b'), entry('c')]
    for (const e of [
      'hero_schedule_click',
      'closing_schedule_click',
      'header_schedule_click',
      'sticky_schedule_click',
    ])
      entries.push(event('a', e))
    for (const e of [
      'hero_book_page_click',
      'closing_book_page_click',
      'header_book_page_click',
      'sticky_book_page_click',
    ])
      entries.push(event('b', e))
    for (const e of ['hero_scheduler_click', 'book_schedule_click', 'book_early_schedule_click'])
      entries.push(event('c', e))
    const summary = summarizeActivity(entries)
    expect(summary.booking.schedule).toBe(7)
    expect(summary.visitorDays).toBe(3)
    expect(summary.bookingVisitorDays).toBe(2)
    expect(summary.bookingRate).toBeCloseTo(2 / 3)
    expect(summary.clicksByEvent).toContainEqual(['hero_book_page_click', 1])
  })

  it('includes direct booking visitors and counts client arrivals once', () => {
    const summary = summarizeActivity([
      entry('a'),
      event('a', 'hero_book_page_click'),
      event('a', 'book_page_view'),
      entry('b', { p: '/book' }),
      event('a', 'book_schedule_click'),
      event('b', 'visit_call_click'),
    ])
    expect(summary.pageViews).toBe(1)
    expect(summary.bookPageViews).toBe(2)
    expect(summary.visitorDays).toBe(2)
    expect(summary.bookingVisitorDays).toBe(2)
    expect(summary.bookingRate).toBe(1)
    expect(summary.booking).toEqual({ schedule: 1, callback: 0, call: 1 })
    expect(summarizeActivity([]).bookingRate).toBe(0)
  })

  it.each([
    ['2026-11-21', '2026-11-22T07:00:00.000Z'],
    ['2026-07-21', '2026-07-22T06:00:00.000Z'],
  ])('uses Denver days across UTC midnight on %s', (day, midnight) => {
    const evening = `${day}T23:30:00.000Z`
    const later = new Date(Date.parse(evening) + 3.5 * 60 * 60_000).toISOString()
    const entries = [
      entry('a', { t: evening, p: '/book' }),
      event('a', 'book_schedule_click', evening),
      entry('a', { t: later, p: '/book' }),
      event('a', 'book_schedule_click', later),
    ]
    expect(activityDay(new Date(later))).toBe(day)
    const summary = summarizeActivity(entries)
    expect(summary.visitorDays).toBe(1)
    expect(summary.visitorsByDay).toEqual([[day, 1]])
    expect(summary.bookingVisitorDays).toBe(1)
    expect(summary.bookingRate).toBe(1)
    entries.push(entry('b', { t: midnight, p: '/book' }))
    expect(summarizeActivity(entries).visitorDays).toBe(2)
  })

  it('classifies people, AI agents, search bots, and scripts', () => {
    expect(classifyAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1').a).toBe('human')
    expect(classifyAgent('ChatGPT-User/1.0')).toEqual({ a: 'ai-agent', an: 'ChatGPT-User' })
    expect(classifyAgent('Googlebot/2.1').an).toBe('Googlebot')
    expect(classifyAgent('curl/8.6.0').a).toBe('other-bot')
  })

  it('preserves report totals, referrers, countries, agents, tools, and Markdown', () => {
    const summary = summarizeActivity([
      entry('a', { r: 'www.google.com', c: 'US' }),
      entry('a', { c: 'US' }),
      entry('b'),
      entry('b', { p: '/book' }),
      event('a', 'hero_scheduler_click'),
      event('b', 'visit_call_click'),
      event('b', 'book_early_schedule_click'),
      entry('', { a: 'ai-agent', an: 'ChatGPT-User', p: '/llms.txt', md: true }),
      entry('', {
        a: 'ai-agent',
        an: 'Claude-User',
        p: '/mcp',
        k: 'mcp',
        tool: 'get_booking_options',
      }),
      entry('b', { p: '/mcp', k: 'mcp', tool: 'get_faq', via: 'webmcp' }),
      entry('', { a: 'search-bot', an: 'Googlebot' }),
    ])
    expect(summary.pageViews).toBe(3)
    expect(summary.bookPageViews).toBe(1)
    expect(summary.visitorDays).toBe(2)
    expect(summary.booking).toEqual({ schedule: 2, callback: 0, call: 1 })
    expect(summary.bookingVisitorDays).toBe(2)
    expect(summary.referrers).toEqual([['www.google.com', 1]])
    expect(summary.countries).toEqual([['US', 2]])
    expect(summary.aiAgents).toEqual([
      ['ChatGPT-User', 1],
      ['Claude-User', 1],
    ])
    expect(summary.mcpTools).toEqual([
      ['get_booking_options', 1],
      ['get_faq (WebMCP)', 1],
    ])
    expect(summary.searchBots).toEqual([['Googlebot', 1]])
    expect(summary.markdownRequests).toBe(1)
    expect(formatActivityReport(summary, 7)).toContain('2 official scheduler visits')
  })

  it('reads JSON exported D1 rows with the date cutoff and null fields', () => {
    const rows = JSON.parse(
      JSON.stringify([
        { ...entry('a'), id: 1, r: null, md: 0 },
        { ...event('a', 'book_schedule_click'), id: 2, tool: null },
        entry('old', { t: '2026-01-01T00:00:00.000Z' }),
      ]),
    )
    const entries = readActivityRows(rows, 7, new Date('2026-11-22T00:00:00Z'))
    expect(entries).toHaveLength(2)
    expect(entries[0]).not.toHaveProperty('id')
    expect(entries[0]).not.toHaveProperty('r')
    expect(summarizeActivity(entries).bookingRate).toBe(1)
  })
})
