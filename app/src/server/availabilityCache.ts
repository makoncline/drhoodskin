import { loadAvailability, visitReasons } from '../lib/nextPatientSchedule'
import type { Availability } from '../lib/nextPatientSchedule'

export type CachedVisit = 'office' | 'full-body-exam'
export type CachedAvailability = {
  checkedAt: number
  availability: Availability
}

const reasons: Record<CachedVisit, number> = {
  office: visitReasons.office,
  'full-body-exam': visitReasons.fullBodyExam,
}
const freshMs = 2 * 60_000
const maxStaleMs = 6 * 60 * 60_000
const minForcedRefreshMs = 60_000

const entries = new Map<CachedVisit, CachedAvailability>()
const pending = new Map<CachedVisit, Promise<CachedAvailability>>()

function refresh(visit: CachedVisit) {
  const running = pending.get(visit)
  if (running) return running
  const request = loadAvailability(reasons[visit])
    .then((availability) => {
      const entry = { checkedAt: Date.now(), availability }
      entries.set(visit, entry)
      return entry
    })
    .finally(() => pending.delete(visit))
  pending.set(visit, request)
  return request
}

export async function cachedAvailability(
  visit: CachedVisit,
  { fresh = false } = {},
) {
  const entry = entries.get(visit)
  const age = entry ? Date.now() - entry.checkedAt : Number.POSITIVE_INFINITY
  if (entry && fresh && age < minForcedRefreshMs) return entry
  if (entry && !fresh && age < freshMs) return entry
  if (entry && !fresh && age < maxStaleMs) {
    refresh(visit).catch(() => undefined)
    return entry
  }
  return refresh(visit)
}
