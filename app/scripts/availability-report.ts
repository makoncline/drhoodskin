import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync(resolve(process.env.AVAILABILITY_DB ?? '.data/availability.sqlite'), {
  readOnly: true,
})
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const workingDays = new Set(['Mon', 'Tue', 'Thu', 'Fri'])

function weekdayOf(start: string) {
  return weekdayNames[new Date(`${start.slice(0, 10)}T00:00:00Z`).getUTCDay()]
}

const runs = db
  .prepare(
    'SELECT reason_id, COUNT(*) AS runs, SUM(ok) AS ok, MIN(started_at) AS first, MAX(started_at) AS last FROM runs GROUP BY reason_id',
  )
  .all() as { reason_id: number; runs: number; ok: number; first: string; last: string }[]
console.log('Runs')
for (const row of runs) {
  console.log(`  reason ${row.reason_id}: ${row.ok}/${row.runs} ok, ${row.first} → ${row.last}`)
}

const latest = db
  .prepare(
    'SELECT reason_id, mode, slot_count, first_start, last_start, finished_at FROM runs WHERE ok = 1 AND id IN (SELECT MAX(id) FROM runs WHERE ok = 1 GROUP BY reason_id)',
  )
  .all() as { reason_id: number; mode: string; slot_count: number; first_start: string | null; last_start: string | null; finished_at: string }[]
console.log('\nLatest snapshot')
for (const row of latest) {
  console.log(
    `  reason ${row.reason_id}: ${row.mode}, ${row.slot_count} slots, ${row.first_start ?? '-'} → ${row.last_start ?? '-'}`,
  )
}

const events = db
  .prepare('SELECT reason_id, at, kind, start, detail FROM events ORDER BY id')
  .all() as { reason_id: number; at: string; kind: string; start: string | null; detail: string | null }[]
console.log(`\nEvents (${events.length})`)
const byKind = new Map<string, number>()
for (const event of events) byKind.set(event.kind, (byKind.get(event.kind) ?? 0) + 1)
for (const [kind, count] of byKind) console.log(`  ${kind}: ${count}`)

const unusual = events.filter(
  (event) => (event.kind === 'opened' || event.kind === 'returned') && event.start && !workingDays.has(weekdayOf(event.start)),
)
if (unusual.length > 0) {
  console.log('\nOpenings on non-working days')
  for (const event of unusual) console.log(`  ${event.at} ${event.kind} ${event.start}`)
}

const lifetimes = db
  .prepare(
    `SELECT (julianday(s.gone_at) - julianday(e.at)) * 24 AS hours
     FROM events e JOIN slots s ON s.reason_id = e.reason_id AND s.slot_id = e.slot_id
     WHERE e.kind IN ('opened', 'returned') AND s.gone_at IS NOT NULL AND s.gone_at > e.at`,
  )
  .all() as { hours: number }[]
if (lifetimes.length > 0) {
  const sorted = lifetimes.map((row) => row.hours).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  console.log(`\nOpenings later taken: ${sorted.length}, median time open ${median.toFixed(1)} h`)
}

console.log('\nRecent events')
for (const event of events.slice(-15)) {
  console.log(`  ${event.at} r${event.reason_id} ${event.kind} ${event.start ?? ''} ${event.detail ?? ''}`)
}
db.close()
