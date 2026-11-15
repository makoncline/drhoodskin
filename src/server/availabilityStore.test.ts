import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { openAvailabilityStore, recordRun } from './availabilityStore.ts'
import type { Availability, Slot } from '../lib/nextPatientSchedule.ts'

const reason = 56487
const dirs: string[] = []

function slot(id: string, start: string): Slot {
  return { id, label: '', minutes: 0, start, href: `https://nextpatient.co/p/5596/${id}/appt-book` }
}

function snapshot(...slots: Slot[]): { availability: Availability } {
  const byDate = new Map<string, Slot[]>()
  for (const item of slots)
    byDate.set(item.start.slice(0, 10), [...(byDate.get(item.start.slice(0, 10)) ?? []), item])
  return {
    availability: {
      kind: 'slots',
      days: [...byDate].map(([date, daySlots]) => ({ date, slots: daySlots })),
    },
  }
}

function events(db: ReturnType<typeof openAvailabilityStore>) {
  return (
    db.prepare('SELECT kind, slot_id, start FROM events ORDER BY id').all() as {
      kind: string
      slot_id: string | null
      start: string | null
    }[]
  ).map((row) => `${row.kind}:${row.slot_id ?? row.start}`)
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('availability change detection', () => {
  it('records openings, taken slots, returns, and a later horizon after a silent baseline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'availability-'))
    dirs.push(dir)
    const db = openAvailabilityStore(join(dir, 'store.sqlite'))
    const a = slot('100', '2099-01-12T13:50:00-07:00')
    const b = slot('101', '2099-01-14T08:50:00-07:00')
    const wednesday = slot('205', '2099-01-13T09:40:00-07:00')
    const later = slot('300', '2099-02-20T08:40:00-07:00')

    recordRun(db, reason, new Date().toISOString(), snapshot(a, b))
    expect(events(db)).toEqual([])

    recordRun(db, reason, new Date().toISOString(), snapshot(b, wednesday))
    expect(events(db)).toEqual(['opened:205', 'taken:100'])

    recordRun(db, reason, new Date().toISOString(), snapshot(a, b, wednesday, later))
    expect(events(db).slice(2)).toEqual(['returned:100', 'opened:300', `horizon:${later.start}`])
    db.close()
  })

  it('records failed runs without touching slots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'availability-'))
    dirs.push(dir)
    const db = openAvailabilityStore(join(dir, 'store.sqlite'))
    recordRun(
      db,
      reason,
      new Date().toISOString(),
      snapshot(slot('1', '2099-01-12T13:50:00-07:00')),
    )
    recordRun(db, reason, new Date().toISOString(), { error: 'Schedule request failed (503)' })
    const row = db
      .prepare('SELECT COUNT(*) AS gone FROM slots WHERE gone_at IS NOT NULL')
      .get() as {
      gone: number
    }
    expect(row.gone).toBe(0)
    expect(events(db)).toEqual([])
    db.close()
  })
})
