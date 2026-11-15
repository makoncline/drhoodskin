import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyAgent, requestContext, writeActivity } from './activityLog.ts'
import { readActivity, summarizeActivity } from './activityReport.ts'

const dirs: string[] = []
afterEach(() => {
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
        e: 'hero_schedule_click',
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
