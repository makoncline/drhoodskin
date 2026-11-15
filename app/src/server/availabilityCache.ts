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

const entries = new Map<CachedVisit, CachedAvailability>()
const pending = new Map<CachedVisit, Promise<CachedAvailability>>()
const failures = new Map<CachedVisit, RefreshFailure>()

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
      const delayMs = previous
        ? Math.min(previous.delayMs * 2, maxRetryMs)
        : initialRetryMs
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
    refresh(visit).catch(() => undefined)
    return entry
  }
  return refresh(visit)
}
