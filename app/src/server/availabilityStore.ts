import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Availability } from '../lib/nextPatientSchedule.ts'

export type EventKind = 'opened' | 'returned' | 'taken' | 'horizon' | 'mode'

export function openAvailabilityStore(path: string) {
  mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY,
      reason_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      ok INTEGER NOT NULL,
      mode TEXT,
      slot_count INTEGER,
      first_start TEXT,
      last_start TEXT,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS slots (
      reason_id INTEGER NOT NULL,
      slot_id TEXT NOT NULL,
      start TEXT NOT NULL,
      href TEXT NOT NULL,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      gone_at TEXT,
      PRIMARY KEY (reason_id, slot_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      reason_id INTEGER NOT NULL,
      at TEXT NOT NULL,
      kind TEXT NOT NULL,
      slot_id TEXT,
      start TEXT,
      detail TEXT
    );
  `)
  return db
}

type StoredSlot = { slot_id: string; start: string; gone_at: string | null }
type LastRun = { mode: string | null; last_start: string | null }

export function recordRun(
  db: DatabaseSync,
  reasonId: number,
  startedAt: string,
  result: { availability: Availability } | { error: string },
) {
  const finishedAt = new Date().toISOString()

  if ('error' in result) {
    db.prepare(
      'INSERT INTO runs (reason_id, started_at, finished_at, ok, error) VALUES (?, ?, ?, 0, ?)',
    ).run(reasonId, startedAt, finishedAt, result.error)
    return { events: 0 }
  }

  const { availability } = result
  const slots =
    availability.kind === 'slots'
      ? availability.days.flatMap((day) => day.slots)
      : []
  const previousRun = db
    .prepare('SELECT mode, last_start FROM runs WHERE reason_id = ? AND ok = 1 ORDER BY id DESC LIMIT 1')
    .get(reasonId) as LastRun | undefined
  const isBaseline = !previousRun
  const known = new Map(
    (
      db
        .prepare('SELECT slot_id, start, gone_at FROM slots WHERE reason_id = ?')
        .all(reasonId) as StoredSlot[]
    ).map((slot) => [slot.slot_id, slot]),
  )
  const addEvent = db.prepare(
    'INSERT INTO events (reason_id, at, kind, slot_id, start, detail) VALUES (?, ?, ?, ?, ?, ?)',
  )
  let events = 0
  const emit = (kind: EventKind, slotId: string | null, start: string | null, detail: string | null) => {
    if (isBaseline) return
    addEvent.run(reasonId, finishedAt, kind, slotId, start, detail)
    events += 1
  }

  db.exec('BEGIN')
  try {
    const seen = new Set<string>()
    for (const slot of slots) {
      seen.add(slot.id)
      const existing = known.get(slot.id)
      if (!existing) {
        db.prepare(
          'INSERT INTO slots (reason_id, slot_id, start, href, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(reasonId, slot.id, slot.start, slot.href, finishedAt, finishedAt)
        emit('opened', slot.id, slot.start, null)
      } else {
        db.prepare(
          'UPDATE slots SET last_seen = ?, gone_at = NULL, start = ? WHERE reason_id = ? AND slot_id = ?',
        ).run(finishedAt, slot.start, reasonId, slot.id)
        if (existing.gone_at) emit('returned', slot.id, slot.start, `gone since ${existing.gone_at}`)
      }
    }

    for (const slot of known.values()) {
      if (slot.gone_at || seen.has(slot.slot_id)) continue
      db.prepare('UPDATE slots SET gone_at = ? WHERE reason_id = ? AND slot_id = ?').run(
        finishedAt,
        reasonId,
        slot.slot_id,
      )
      if (Date.parse(slot.start) > Date.now()) emit('taken', slot.slot_id, slot.start, null)
    }

    const starts = slots.map((slot) => slot.start).sort()
    const lastStart = starts.at(-1) ?? null
    if (previousRun?.mode && previousRun.mode !== availability.kind) {
      emit('mode', null, null, `${previousRun.mode} -> ${availability.kind}`)
    }
    if (previousRun?.last_start && lastStart && lastStart.slice(0, 10) > previousRun.last_start.slice(0, 10)) {
      emit('horizon', null, lastStart, `from ${previousRun.last_start.slice(0, 10)}`)
    }

    db.prepare(
      'INSERT INTO runs (reason_id, started_at, finished_at, ok, mode, slot_count, first_start, last_start) VALUES (?, ?, ?, 1, ?, ?, ?, ?)',
    ).run(reasonId, startedAt, finishedAt, availability.kind, slots.length, starts[0] ?? null, lastStart)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return { events }
}
