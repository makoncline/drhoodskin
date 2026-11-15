import { drHoodVerified } from '../content/drHoodVerified'

const officeTimeZone = 'America/Denver'

type DayHours = { day: string; opens: number; closes: number } | { day: string; closed: true }

export type OfficeStatus =
  | { open: true; closesLabel: string }
  | { open: false; nextOpenLabel: string }

function parseClock(value: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim())
  if (!match) throw new Error(`Unrecognized office time: ${value}`)
  const hour = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0)
  return hour * 60 + Number(match[2])
}

export function formatClock(minutes: number) {
  const hour24 = Math.floor(minutes / 60)
  const minute = String(minutes % 60).padStart(2, '0')
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${minute} ${suffix}`
}

export const weeklyHours: DayHours[] = drHoodVerified.office.hours.map(([day, hours]) => {
  if (hours === 'Closed') return { day, closed: true }
  const [opens, closes] = hours.split('-')
  return { day, opens: parseClock(opens), closes: parseClock(closes) }
})

export function formatDayHours(entry: DayHours) {
  if ('closed' in entry) return 'Closed'
  return `${formatClock(entry.opens)} – ${formatClock(entry.closes)}`
}

export function formatClock24(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function openingHoursSpecification() {
  return weeklyHours.flatMap((entry) =>
    'closed' in entry
      ? []
      : [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: entry.day,
            opens: formatClock24(entry.opens),
            closes: formatClock24(entry.closes),
          },
        ],
  )
}

export function openHoursSummary() {
  const openDays = weeklyHours.filter((entry) => !('closed' in entry))
  const ranges = new Set(openDays.map(formatDayHours))
  const days = openDays.map((entry) => entry.day.slice(0, 3)).join(', ')
  return ranges.size === 1 ? `${days}, ${[...ranges][0]}` : days
}

export function officeNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: officeTimeZone,
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return {
    day: part('weekday'),
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  }
}

export function officeStatus(date = new Date()): OfficeStatus {
  const now = officeNow(date)
  const todayIndex = weeklyHours.findIndex((entry) => entry.day === now.day)
  const today = weeklyHours[todayIndex]

  if (!('closed' in today) && now.minutes >= today.opens && now.minutes < today.closes) {
    return { open: true, closesLabel: formatClock(today.closes) }
  }

  for (let offset = 0; offset < 8; offset += 1) {
    const entry = weeklyHours[(todayIndex + offset) % weeklyHours.length]
    if ('closed' in entry) continue
    if (offset === 0 && now.minutes >= entry.opens) continue
    const dayLabel = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : entry.day
    return { open: false, nextOpenLabel: `${dayLabel} at ${formatClock(entry.opens)}` }
  }

  throw new Error('Office hours have no open day')
}
