import { createHash, randomBytes } from 'node:crypto'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type AgentClass = 'human' | 'ai-agent' | 'search-bot' | 'other-bot'

export type ActivityEntry = {
  t: string
  k: 'request' | 'event' | 'mcp'
  p: string
  a: AgentClass
  an?: string
  v?: string
  c?: string
  r?: string
  md?: boolean
  e?: string
  tool?: string
  via?: 'webmcp'
}

const aiAgents: [RegExp, string][] = [
  [/ChatGPT-User/i, 'ChatGPT-User'],
  [/OAI-SearchBot/i, 'OAI-SearchBot'],
  [/GPTBot/i, 'GPTBot'],
  [/Claude-User/i, 'Claude-User'],
  [/Claude-SearchBot/i, 'Claude-SearchBot'],
  [/ClaudeBot/i, 'ClaudeBot'],
  [/Perplexity-User/i, 'Perplexity-User'],
  [/PerplexityBot/i, 'PerplexityBot'],
  [/Google-CloudVertexBot|Gemini/i, 'Google AI'],
  [/meta-externalagent|meta-externalfetcher/i, 'Meta AI'],
  [/DuckAssistBot/i, 'DuckAssistBot'],
  [/Amazonbot/i, 'Amazonbot'],
  [/MistralAI-User/i, 'MistralAI-User'],
]

const searchBots: [RegExp, string][] = [
  [/Googlebot/i, 'Googlebot'],
  [/bingbot/i, 'Bingbot'],
  [/Applebot/i, 'Applebot'],
  [/DuckDuckBot/i, 'DuckDuckBot'],
  [/YandexBot/i, 'YandexBot'],
]

export function classifyAgent(userAgent: string): {
  a: AgentClass
  an?: string
} {
  for (const [pattern, name] of aiAgents)
    if (pattern.test(userAgent)) return { a: 'ai-agent', an: name }
  for (const [pattern, name] of searchBots)
    if (pattern.test(userAgent)) return { a: 'search-bot', an: name }
  if (
    !userAgent ||
    /bot|crawl|spider|curl|wget|python|httpx|axios|node-fetch|go-http|headless/i.test(
      userAgent,
    )
  ) {
    return { a: 'other-bot' }
  }
  return { a: 'human' }
}

let salt = { day: '', value: '' }

function dailySalt(day: string) {
  if (salt.day !== day) salt = { day, value: randomBytes(16).toString('hex') }
  return salt.value
}

export function visitorId(ip: string, userAgent: string, day: string) {
  return createHash('sha256')
    .update(`${dailySalt(day)}|${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 12)
}

export function requestContext(headers: Headers, siteHost: string) {
  const userAgent = headers.get('user-agent') ?? ''
  const agent = classifyAgent(userAgent)
  const now = new Date()
  const ip =
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    ''
  const referrer = headers.get('referer')
  let referrerHost: string | undefined
  if (referrer) {
    try {
      const host = new URL(referrer).hostname
      if (host !== siteHost) referrerHost = host
    } catch {
      referrerHost = undefined
    }
  }
  return {
    t: now.toISOString(),
    ...agent,
    v:
      agent.a === 'human'
        ? visitorId(ip, userAgent, now.toISOString().slice(0, 10))
        : undefined,
    c: headers.get('cf-ipcountry') ?? undefined,
    r: referrerHost,
  }
}

export function writeActivity(
  entry: ActivityEntry,
  logDir = process.env.LOG_DIR,
) {
  const line = JSON.stringify(entry)
  console.log(line)
  if (!logDir) return
  try {
    mkdirSync(logDir, { recursive: true })
    appendFileSync(
      join(logDir, `activity-${entry.t.slice(0, 10)}.jsonl`),
      `${line}\n`,
    )
  } catch (error) {
    console.error('Activity log write failed', error)
  }
}
