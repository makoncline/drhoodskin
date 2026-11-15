import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { availability } from '../../db/schema'
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
const maxStaleMs = 6 * 60 * 60_000
const hourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  hour: 'numeric',
  hourCycle: 'h23',
})

export async function cachedAvailability(visit: CachedVisit): Promise<CachedAvailability> {
  const [row] = await drizzle(env.DB)
    .select()
    .from(availability)
    .where(eq(availability.visit, visit))
  if (!row?.snapshot || row.checkedAt === null || Date.now() - row.checkedAt >= maxStaleMs)
    throw new Error('Open times could not be loaded.')
  return {
    checkedAt: row.checkedAt,
    availability: row.snapshot,
    ...(row.error ? { refreshFailed: true } : {}),
  }
}

export async function refreshDueAvailability(db: D1Database, now: number) {
  const row = await db
    .prepare(
      'UPDATE availability SET due_at = ? WHERE visit = (SELECT visit FROM availability WHERE due_at <= ? ORDER BY due_at, visit LIMIT 1) RETURNING visit, retry_ms',
    )
    .bind(now + 3 * 60_000, now)
    .first<{ visit: CachedVisit; retry_ms: number }>()
  if (!row) return
  try {
    const snapshot = await loadAvailability(reasons[row.visit])
    const hour = Number(hourFormatter.format(new Date(now)))
    const interval = hour >= 6 && hour < 22 ? 4 * 60_000 : 30 * 60_000
    await drizzle(db)
      .update(availability)
      .set({
        snapshot,
        checkedAt: now,
        dueAt: now + interval,
        retryMs: 0,
        error: null,
      })
      .where(eq(availability.visit, row.visit))
  } catch (error) {
    const retryMs = Math.min(row.retry_ms ? row.retry_ms * 2 : 60_000, 15 * 60_000)
    const message = error instanceof Error ? error.message : 'Schedule request failed'
    await drizzle(db)
      .update(availability)
      .set({
        dueAt: now + retryMs,
        retryMs,
        error: message,
      })
      .where(eq(availability.visit, row.visit))
    console.error(`[availability] ${row.visit}: ${message}`)
  }
}
