import { resolve } from 'node:path'
import { loadAvailability, visitReasons } from '../../src/lib/nextPatientSchedule.ts'
import { openAvailabilityStore, recordRun } from '../../src/server/availabilityStore.ts'

function isPollingHours(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', hourCycle: 'h23' }).format(date),
  )
  return hour >= 6 && hour < 22
}

if (!process.argv.includes('--force') && !isPollingHours()) process.exit(0)

const storePath = resolve(process.env.AVAILABILITY_DB ?? '.data/availability.sqlite')
const db = openAvailabilityStore(storePath)

for (const [name, reasonId] of Object.entries(visitReasons)) {
  const startedAt = new Date().toISOString()
  try {
    const availability = await loadAvailability(reasonId)
    const { events } = recordRun(db, reasonId, startedAt, { availability })
    const count =
      availability.kind === 'slots'
        ? availability.days.reduce((sum, day) => sum + day.slots.length, 0)
        : 0
    console.log(`${startedAt} ${name}: ${availability.kind}, ${count} slots, ${events} events`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    recordRun(db, reasonId, startedAt, { error: message })
    console.error(`${startedAt} ${name}: error ${message}`)
  }
}

db.close()
