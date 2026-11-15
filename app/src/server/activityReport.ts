import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ActivityEntry } from './activityLog.ts'

export const bookingEvents = {
  schedule: /_schedule_click$/,
  callback: /_callback_click$/,
  call: /_call_click$/,
} as const

export function readActivity(logDir: string, days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString()
  const entries: ActivityEntry[] = []
  if (!existsSync(logDir)) return entries
  for (const file of readdirSync(logDir)
    .filter((name) => /^activity-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
    .sort()) {
    if (file.slice(9, 19) < since.slice(0, 10)) continue
    for (const line of readFileSync(join(logDir, file), 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line) as ActivityEntry
        if (entry.t >= since) entries.push(entry)
      } catch {
        continue
      }
    }
  }
  return entries
}

function countBy<T>(items: T[], key: (item: T) => string | undefined) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const value = key(item)
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])
}

export function summarizeActivity(entries: ActivityEntry[]) {
  const humans = entries.filter((entry) => entry.a === 'human')
  const pageViews = humans.filter(
    (entry) => entry.k === 'request' && entry.p === '/',
  )
  const bookPageViews = humans.filter(
    (entry) => entry.k === 'request' && entry.p === '/book',
  )
  const visitorsByDay = new Map<string, Set<string>>()
  for (const view of pageViews) {
    if (!view.v) continue
    const day = view.t.slice(0, 10)
    visitorsByDay.set(day, (visitorsByDay.get(day) ?? new Set()).add(view.v))
  }
  const visitorDays = [...visitorsByDay.values()].reduce(
    (sum, set) => sum + set.size,
    0,
  )
  const events = humans.filter((entry) => entry.k === 'event')
  const booking = Object.fromEntries(
    Object.entries(bookingEvents).map(([name, pattern]) => [
      name,
      events.filter((entry) => entry.e && pattern.test(entry.e)).length,
    ]),
  ) as Record<keyof typeof bookingEvents, number>
  const bookingVisitors = new Set(
    events
      .filter(
        (entry) =>
          entry.e &&
          Object.values(bookingEvents).some((pattern) =>
            pattern.test(entry.e ?? ''),
          ),
      )
      .map((entry) => `${entry.t.slice(0, 10)}|${entry.v}`),
  )
  const agents = entries.filter((entry) => entry.a === 'ai-agent')

  return {
    pageViews: pageViews.length,
    bookPageViews: bookPageViews.length,
    visitorDays,
    visitorsByDay: [...visitorsByDay]
      .map(([day, set]) => [day, set.size] as const)
      .sort(),
    booking,
    bookingVisitorDays: bookingVisitors.size,
    bookingRate: visitorDays === 0 ? 0 : bookingVisitors.size / visitorDays,
    clicksByEvent: countBy(events, (entry) => entry.e),
    referrers: countBy(pageViews, (entry) => entry.r).slice(0, 10),
    countries: countBy(pageViews, (entry) => entry.c).slice(0, 10),
    aiAgents: countBy(agents, (entry) => entry.an),
    aiAgentPaths: countBy(agents, (entry) => entry.p).slice(0, 10),
    searchBots: countBy(
      entries.filter((entry) => entry.a === 'search-bot'),
      (entry) => entry.an,
    ),
    mcpTools: countBy(
      entries.filter((entry) => entry.k === 'mcp'),
      (entry) =>
        entry.via === 'webmcp' ? `${entry.tool} (WebMCP)` : entry.tool,
    ),
    markdownRequests: entries.filter((entry) => entry.md).length,
  }
}

export function formatActivityReport(
  summary: ReturnType<typeof summarizeActivity>,
  days: number,
) {
  const list = (rows: (readonly [string, number])[]) =>
    rows.length === 0
      ? '  (none)'
      : rows.map(([name, count]) => `  - ${name}: ${count}`).join('\n')
  return [
    `# drhoodskin.com activity, last ${days} days`,
    '',
    `Page views (people): ${summary.pageViews} home, ${summary.bookPageViews} booking page`,
    `Visitors (unique per day, summed): ${summary.visitorDays}`,
    `Booking actions: ${summary.booking.schedule} see open times, ${summary.booking.callback} callback requests, ${summary.booking.call} calls`,
    `Visitors who took a booking action: ${summary.bookingVisitorDays} (${(summary.bookingRate * 100).toFixed(1)}%)`,
    '',
    'Visitors by day:',
    list(summary.visitorsByDay),
    '',
    'Clicks by event:',
    list(summary.clicksByEvent),
    '',
    'Referrers:',
    list(summary.referrers),
    '',
    'Countries:',
    list(summary.countries),
    '',
    'AI agents:',
    list(summary.aiAgents),
    '',
    'Paths read by AI agents:',
    list(summary.aiAgentPaths),
    '',
    'Search bots:',
    list(summary.searchBots),
    '',
    'MCP tool calls:',
    list(summary.mcpTools),
    '',
    `Markdown requests: ${summary.markdownRequests}`,
  ].join('\n')
}
