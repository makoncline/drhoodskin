import { loadAvailability, visitReasons } from '../lib/nextPatientSchedule'
import type { Availability } from '../lib/nextPatientSchedule'

export type CachedVisit = 'office' | 'full-body-exam'
export type CachedAvailability = {
  checkedAt: number
  availability: Availability
  refreshFailed?: boolean
}

const reasons: Record<CachedVisit, number> = {
  office: visitReasons.office,
  'full-body-exam': visitReasons.fullBodyExam,
}
const freshMs = 2 * 60_000
const maxStaleMs = 6 * 60 * 60_000
const minForcedRefreshMs = 60_000
const initialRetryMs = 60_000
const maxRetryMs = 15 * 60_000

type RefreshFailure = { retryAt: number; delayMs: number; error: unknown }
type AvailabilityState = {
  entries: Map<CachedVisit, CachedAvailability>
  pending: Map<CachedVisit, Promise<CachedAvailability>>
  failures: Map<CachedVisit, RefreshFailure>
}
const runtime = globalThis as typeof globalThis & { drHoodAvailability?: AvailabilityState }
// Nitro emits separate handler and SSR bundles in the same process.
const { entries, pending, failures } = (runtime.drHoodAvailability ??= {
  entries: new Map(),
  pending: new Map(),
  failures: new Map(),
})

function refresh(visit: CachedVisit) {
  const running = pending.get(visit)
  if (running) return running
  const request = loadAvailability(reasons[visit])
    .then((availability) => {
      const entry = { checkedAt: Date.now(), availability }
      entries.set(visit, entry)
      failures.delete(visit)
      return entry
    })
    .catch((error: unknown) => {
      const previous = failures.get(visit)
      const delayMs = previous ? Math.min(previous.delayMs * 2, maxRetryMs) : initialRetryMs
      failures.set(visit, { retryAt: Date.now() + delayMs, delayMs, error })
      console.error(
        `[availability] ${visit}: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    })
    .finally(() => pending.delete(visit))
  pending.set(visit, request)
  return request
}

export async function cachedAvailability(
  visit: CachedVisit,
  { fresh = false } = {},
): Promise<CachedAvailability> {
  const entry = entries.get(visit)
  const age = entry ? Date.now() - entry.checkedAt : Number.POSITIVE_INFINITY
  const failure = failures.get(visit)
  if (failure && Date.now() < failure.retryAt) {
    if (entry && age < maxStaleMs) return { ...entry, refreshFailed: true }
    throw failure.error
  }
  if (entry && fresh && age < minForcedRefreshMs) return entry
  if (entry && !fresh && age < freshMs) return entry
  if (entry && !fresh && age < maxStaleMs) {
    void refresh(visit).catch(() => undefined)
    return entry
  }
  return refresh(visit)
}
