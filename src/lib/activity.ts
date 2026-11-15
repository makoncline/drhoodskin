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
    /bot|crawl|spider|curl|wget|python|httpx|axios|node-fetch|go-http|headless/i.test(userAgent)
  ) {
    return { a: 'other-bot' }
  }
  return { a: 'human' }
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Denver',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function activityDay(date: Date) {
  return dayFormatter.format(date)
}
