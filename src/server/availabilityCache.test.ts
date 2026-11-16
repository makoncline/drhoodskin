import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextPatientFixture } from '../../scripts/dev/nextpatient.js'

let fixture: ReturnType<typeof nextPatientFixture>
let cachedAvailability: typeof import('./availabilityCache').cachedAvailability
const start = Date.parse('2026-11-16T07:00:00Z')

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(start)
  vi.stubGlobal('drHoodAvailability', undefined)
  fixture = nextPatientFixture()
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    fixture.outbound(new Request(input, init)),
  )
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  cachedAvailability = (await import('./availabilityCache')).cachedAvailability
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const officeReads = () => fixture.requests.filter((request) => request.reason === '56487').length

describe('Node availability lifecycle', () => {
  it('shares a cold refresh and limits manual refreshes', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => cachedAvailability('office')))
    expect(results.every((result) => result.checkedAt === start)).toBe(true)
    const reads = officeReads()
    expect(reads).toBeGreaterThan(0)
    expect(reads).toBeLessThanOrEqual(31)
    vi.setSystemTime(start + 59_999)
    expect((await cachedAvailability('office', { fresh: true })).checkedAt).toBe(start)
    expect(officeReads()).toBe(reads)
    vi.setSystemTime(start + 60_000)
    expect((await cachedAvailability('office', { fresh: true })).checkedAt).toBe(start + 60_000)
    expect(officeReads()).toBe(reads * 2)
  })

  it('bounds failure retries independently for each visit and recovers', async () => {
    fixture.modes.office = 'failed'
    let now = start
    for (const [index, delay] of [60_000, 120_000, 240_000, 480_000, 900_000, 900_000].entries()) {
      vi.setSystemTime(now)
      await expect(cachedAvailability('office', { fresh: true })).rejects.toThrow('503')
      expect(officeReads()).toBe(index + 1)
      vi.setSystemTime(now + delay - 1)
      await expect(cachedAvailability('office', { fresh: true })).rejects.toThrow('503')
      expect(officeReads()).toBe(index + 1)
      now += delay
    }
    expect((await cachedAvailability('full-body-exam')).availability.kind).toBe('slots')
    fixture.modes.office = 'slots'
    vi.setSystemTime(now)
    const recovered = await cachedAvailability('office', { fresh: true })
    expect(recovered.refreshFailed).toBeUndefined()
    expect(recovered.availability.kind).toBe('slots')
    fixture.modes.office = 'failed'
    vi.setSystemTime(now + 120_000)
    await expect(cachedAvailability('office', { fresh: true })).rejects.toThrow('503')
    const attempts = officeReads()
    vi.setSystemTime(now + 180_000)
    await expect(cachedAvailability('office', { fresh: true })).rejects.toThrow('503')
    expect(officeReads()).toBe(attempts + 1)
  })

  it('serves usable stale data after a background failure but rejects expired data', async () => {
    const first = await cachedAvailability('office')
    fixture.modes.office = 'failed'
    vi.setSystemTime(start + 120_001)
    expect((await cachedAvailability('office')).availability).toEqual(first.availability)
    await vi.waitFor(async () => {
      expect((await cachedAvailability('office')).refreshFailed).toBe(true)
    })
    expect((await cachedAvailability('office')).checkedAt).toBe(start)
    vi.setSystemTime(start + 6 * 60 * 60_000)
    await expect(cachedAvailability('office')).rejects.toThrow('503')
  })
})
