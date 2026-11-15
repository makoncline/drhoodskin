import { daysBetween, findEarlyOpenings } from './nextPatientSchedule'
import type { ScheduleDay, Slot } from './nextPatientSchedule'

export const weekdays = [
  { code: 'mon', name: 'Monday', index: 1 },
  { code: 'tue', name: 'Tuesday', index: 2 },
  { code: 'wed', name: 'Wednesday', index: 3 },
  { code: 'thu', name: 'Thursday', index: 4 },
  { code: 'fri', name: 'Friday', index: 5 },
  { code: 'sat', name: 'Saturday', index: 6 },
  { code: 'sun', name: 'Sunday', index: 0 },
] as const

export const timeBands = [
  {
    id: 'early-morning',
    label: 'Early morning',
    range: 'before 10 AM',
    from: 0,
    to: 600,
  },
  {
    id: 'late-morning',
    label: 'Late morning',
    range: '10 AM to noon',
    from: 600,
    to: 720,
  },
  {
    id: 'early-afternoon',
    label: 'Early afternoon',
    range: 'noon to 2 PM',
    from: 720,
    to: 840,
  },
  {
    id: 'late-afternoon',
    label: 'Late afternoon',
    range: 'after 2 PM',
    from: 840,
    to: 1440,
  },
] as const

export type WeekdayCode = (typeof weekdays)[number]['code']
export type TimeBandId = (typeof timeBands)[number]['id']
export type AppointmentFilter = { days: WeekdayCode[]; times: TimeBandId[] }
export type Opening = { date: string; slot: Slot }

const weekdayCodes = weekdays.map((day) => day.code) as string[]
const bandIds = timeBands.map((band) => band.id) as string[]

function listParam(value: unknown) {
  if (Array.isArray(value))
    return value.flatMap((item) => String(item).split(','))
  if (typeof value === 'string') return value.split(',')
  return []
}

export function parseFilter(input: {
  days?: unknown
  times?: unknown
}): AppointmentFilter {
  const days = listParam(input.days)
    .map((item) => item.trim().toLowerCase().slice(0, 3))
    .filter((item): item is WeekdayCode => weekdayCodes.includes(item))
  const times = listParam(input.times)
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is TimeBandId => bandIds.includes(item))
  return {
    days: weekdays.map((day) => day.code).filter((code) => days.includes(code)),
    times: timeBands.map((band) => band.id).filter((id) => times.includes(id)),
  }
}

export function weekdayOf(iso: string): WeekdayCode {
  const index = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return weekdays.find((day) => day.index === index)?.code ?? 'sun'
}

export function bandOf(minutes: number): TimeBandId {
  return (
    timeBands.find((band) => minutes >= band.from && minutes < band.to) ??
    timeBands[3]
  ).id
}

export function isFiltered(filter: AppointmentFilter) {
  return filter.days.length > 0 || filter.times.length > 0
}

export function parseAvoid(input: unknown) {
  return listParam(input).flatMap((item) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.exec(
      item.trim(),
    )
    if (!match) return []
    const from = Number(match[1]) * 60 + Number(match[2])
    const to = Number(match[3]) * 60 + Number(match[4])
    return from < to ? [{ from, to }] : []
  })
}

export function openingMatches(
  { date, slot }: Opening,
  filter: AppointmentFilter,
  avoid: ReturnType<typeof parseAvoid> = [],
) {
  return (
    (filter.days.length === 0 || filter.days.includes(weekdayOf(date))) &&
    (filter.times.length === 0 ||
      filter.times.includes(bandOf(slot.minutes))) &&
    !avoid.some(({ from, to }) => slot.minutes >= from && slot.minutes < to)
  )
}

function joinOr(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`
}

export function describeFilter(filter: AppointmentFilter) {
  const days =
    filter.days.length === 0
      ? 'Any day'
      : joinOr(
          filter.days.map(
            (code) => `${weekdays.find((day) => day.code === code)?.name}s`,
          ),
        )
  const times =
    filter.times.length === 0
      ? 'any time'
      : joinOr(
          filter.times.map(
            (id) =>
              timeBands.find((band) => band.id === id)?.label.toLowerCase() ??
              id,
          ),
        )
  return `${days}, ${times}`
}

export function searchOpenings(
  days: ScheduleDay[],
  filter: AppointmentFilter,
  today: string,
  avoid: ReturnType<typeof parseAvoid> = [],
) {
  const openings = days.flatMap((day) =>
    day.slots.map((slot) => ({ date: day.date, slot })),
  )
  const early = findEarlyOpenings(days, today)
  const earlyDates = new Set(early?.openings.map((opening) => opening.date))
  const matches = openings.filter((opening) =>
    openingMatches(opening, filter, avoid),
  )
  return {
    soonest: openings.at(0) ?? null,
    matches,
    usualFirstOpening: early?.regularStart ?? null,
    isEarlier: (date: string) => earlyDates.has(date),
    waitDays: (date: string) => daysBetween(today, date),
  }
}
