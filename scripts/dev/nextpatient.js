import { addDays, isoToday } from '../../src/lib/nextPatientSchedule.ts'

const drifted = {
  'drifted-time': '<a class="nextpatient-slot-time" href="/p/5596/111/appt-book">Morning</a>',
  'drifted-path': '<a class="nextpatient-slot-time" href="/booking/111">8:40am</a>',
  'drifted-origin':
    '<a class="nextpatient-slot-time" href="https://example.com/p/5596/111/appt-book">8:40am</a>',
  'drifted-url': '<a class="nextpatient-slot-time" href="https://[invalid">8:40am</a>',
}

export function nextPatientFixture() {
  const today = isoToday()
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay()
  const monday = addDays(today, (8 - weekday) % 7 || 7)
  const officeStart = addDays(monday, 56)
  const schedule = (start, rows) =>
    Object.fromEntries(rows.map(([offset, times]) => [addDays(start, offset), times]))
  const office = schedule(officeStart, [
    [0, ['8:40am', '9:00am', '10:00am', '2:00pm']],
    [1, ['8:50am', '11:00am']],
    [2, ['1:00pm']],
    [3, ['8:40am', '2:30pm']],
    [4, ['8:40am', '8:50am', '9:30am', '2:50pm']],
    [7, ['8:40am', '2:40pm']],
    [8, ['8:40am']],
  ])
  const exam = schedule(monday, [
    [0, ['2:30pm']],
    [4, ['10:30am']],
  ])
  const modes = { office: 'slots', exam: 'slots' }
  const requests = []
  let concurrent = 0,
    maxConcurrent = 0
  async function outbound(request) {
    const url = new URL(request.url)
    const reason = url.searchParams.get('reason_id')
    const day = url.searchParams.get('day')
    if (
      request.method !== 'GET' ||
      url.origin !== 'https://nextpatient.co' ||
      url.pathname !== '/p/5596/schedule.json' ||
      url.searchParams.get('entity_id') !== '60744' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') ||
      !['56487', '56485'].includes(reason)
    ) {
      throw new Error('External network request blocked by the development runtime.')
    }
    requests.push({ day, reason })
    concurrent += 1
    maxConcurrent = Math.max(maxConcurrent, concurrent)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2))
      const visit = reason === '56487' ? 'office' : 'exam'
      const mode = modes[visit]
      if (mode === 'failed') return new Response(null, { status: 503 })
      if (mode === 'redirect')
        return new Response(null, {
          status: 302,
          headers: { location: 'https://nextpatient.co/p/5596/111/appt-book' },
        })
      const times = visit === 'office' ? office : exam
      let next = ''
      let html
      if (mode === 'slots' || mode === 'horizon' || mode === 'dense') {
        const cells = Array.from({ length: 3 }, (_, i) => {
          const date = addDays(day, i)
          const labels = mode === 'dense'
            ? date >= monday
              ? ['8am', '8:30am', '9am', '9:30am', '10am', '10:30am', '11am', '11:30am', '1pm', '1:30pm', '2pm', '2:30pm']
              : []
            : mode === 'horizon' ? ['8:40am'] : (times[date] ?? [])
          const links = labels.map(
            (time, slot) =>
              `<a class="nextpatient-slot-time" href="/p/5596/${reason}${date.replaceAll('-', '')}${slot}/appt-book?reason_id=${reason}&amp;location_id=5596"><span>${time}</span></a>`,
          )
          return `<td class="nextpatient-schedule-day-slots">${links.join('')}</td>`
        })
        next = Object.keys(times).find((date) => date >= day) ?? ''
        html = `<table><tr>${cells.join('')}<td class="nextpatient-schedule-day-slots nextpatient-schedule-next-available">First available</td></tr></table>`
      } else if (mode === 'phone-only') html = '<p>Please call to schedule</p>'
      else if (mode === 'empty')
        html =
          '<td class="nextpatient-schedule-day-slots nextpatient-schedule-next-available" colspan=3>No times available</td>'
      else if (drifted[mode])
        html = `<td class="nextpatient-schedule-day-slots">${drifted[mode]}</td>`
      else html = '<p>Down for maintenance</p>'
      return Response.json({ html, day, next_slot_day: next })
    } finally {
      concurrent -= 1
    }
  }
  return {
    modes,
    requests,
    outbound,
    officeStart,
    monday,
    get maxConcurrent() {
      return maxConcurrent
    },
  }
}
