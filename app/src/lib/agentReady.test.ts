import { describe, expect, it } from 'vitest'
import {
  bookingPayload,
  callSiteTool,
  contactPayload,
  getFaqResult,
  getServicesResult,
  mcpTools,
  searchSiteContent,
  skillsIndex,
  sitemapXml,
} from './agentReady'

describe('agent-ready surfaces', () => {
  it('publishes a valid-looking skills index', () => {
    expect(skillsIndex.$schema).toContain('agentskills.io')
    expect(skillsIndex.skills).toHaveLength(2)
    expect(skillsIndex.skills.every((skill) => skill.digest.startsWith('sha256:'))).toBe(
      true,
    )
    expect(skillsIndex.skills.every((skill) => skill.url.startsWith('https://drhoodskin.com/'))).toBe(true)
  })

  it('returns official booking guidance from the site tool', () => {
    const result = callSiteTool('get_booking_options', undefined)

    expect(result.structuredContent).toMatchObject({
      booking: bookingPayload.booking,
      officialAppointmentPage: bookingPayload.officialAppointmentPage,
    })
  })

  it('keeps MCP tool names unique and sitemap canonical', () => {
    const toolNames = mcpTools.map((tool) => tool.name)

    expect(new Set(toolNames).size).toBe(toolNames.length)
    expect(sitemapXml).toContain('<loc>https://drhoodskin.com/</loc>')
  })

  it('adds sources to focused endpoint payloads', () => {
    expect(contactPayload.sources).not.toHaveLength(0)

    const faq = getFaqResult('insurance coverage')
    expect(faq).toMatchObject({
      matchedQuestion: 'What should I know about insurance coverage?',
    })
    expect('sources' in faq && faq.sources.length > 0).toBe(true)

    const services = getServicesResult('medical')
    expect(services.category).toBe('medical')
    const medical = services.medical
    if (!medical) {
      throw new Error('Expected medical services result')
    }
    expect(medical[0]?.sources.length ?? 0).toBeGreaterThan(0)
  })

  it('searches public content and returns api targets', () => {
    const results = searchSiteContent('eczema Golden insurance', 5)

    expect(results.results.length).toBeGreaterThan(0)
    expect(results.results.every((item) => item.apiUrl.startsWith('https://drhoodskin.com/'))).toBe(
      true,
    )
    expect(results.results.some((item) => item.kind === 'service' || item.kind === 'insurance')).toBe(
      true,
    )
  })
})
