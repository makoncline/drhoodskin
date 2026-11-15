import { parse } from 'node-html-parser'

// These are the public, read-only requests the official NextPatient widget makes.
// They are undocumented; production use needs USDP or NextPatient approval.

const nextPatientOrigin = 'https://nextpatient.co'
const practiceId = '5596'
const entityId = '60744'
const officeTimeZone = 'America/Denver'
const daysPerWindow = 3
const windowBatch = 8
const requestTimeoutMs = 8000
const maxWindows = 64
// Observed online booking window on 2026-11-14: about 90 days ahead.
const observedHorizonDays = 92

export const visitReasons = {
  office: 56487,
  fullBodyExam: 56485,
} as const

export type Slot = {
  id: string
  label: string
  minutes: number
  start: string
  href: string
}
export type ScheduleDay = { date: string; slots: Slot[] }
export type Availability =
  | { kind: 'slots'; days: ScheduleDay[] }
  | { kind: 'phone-only' }
  | { kind: 'none' }

type WindowResponse = { html: string; day: string; next_slot_day: string }

export const officialCalendarUrl = `https://nextpatient.co/p/${practiceId}/${entityId}/appointments`

export function isoToday(timeZone = officeTimeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) /
      86_400_000,
  )
}

export function formatClock(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minutes % 60).padStart(2, '0')} ${suffix}`
}

function parseClock(label: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(label.trim())
  if (!match) return null
  const hour =
    (Number(match[1]) % 12) + (match[3].toLowerCase() === 'pm' ? 12 : 0)
  return hour * 60 + Number(match[2])
}

function offsetFor(date: string, minutes: number) {
  const probe = new Date(
    `${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:00:00Z`,
  )
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: officeTimeZone,
    timeZoneName: 'longOffset',
  })
    .formatToParts(probe)
    .find((part) => part.type === 'timeZoneName')?.value
  return name?.replace('GMT', '') || '+00:00'
}

export function isoStart(date: string, minutes: number) {
  const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return `${date}T${clock}:00${offsetFor(date, minutes)}`
}

async function fetchWindow(
  day: string,
  reasonId: number,
): Promise<WindowResponse> {
  const url = `https://nextpatient.co/p/${practiceId}/schedule.json?day=${day}&reason_id=${reasonId}&entity_id=${entityId}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(requestTimeoutMs),
  })
  if (!response.ok)
    throw new Error(`Schedule request failed (${response.status})`)
  return (await response.json()) as WindowResponse
}

function parseWindow(window: WindowResponse) {
  const root = parse(window.html)
  const phoneOnly = /please call|call to schedule/i.test(root.text)
  if (!root.querySelector('td.nextpatient-schedule-day-slots') && !phoneOnly)
    throw new Error('Unrecognized scheduler response')
  const days: ScheduleDay[] = root
    .querySelectorAll(
      'td.nextpatient-schedule-day-slots:not(.nextpatient-schedule-next-available)',
    )
    .map((column, index) => {
      const date = addDays(window.day, index)
      return {
        date,
        slots: column
          .querySelectorAll('a.nextpatient-slot-time')
          .flatMap((link) => {
            const minutes = parseClock(link.text)
            const url = new URL(
              link.getAttribute('href') ?? '',
              nextPatientOrigin,
            )
            const href = url.toString()
            const id = /^\/p\/\d+\/(\d+)\/appt-book/.exec(url.pathname)?.[1]
            if (minutes === null || !id || url.origin !== nextPatientOrigin)
              return []
            return [
              {
                id,
                label: formatClock(minutes),
                minutes,
                start: isoStart(date, minutes),
                href,
              },
            ]
          }),
      }
    })
  return { days, phoneOnly }
}

export async function loadAvailability(
  reasonId: number,
): Promise<Availability> {
  const today = isoToday()
  const first = await fetchWindow(today, reasonId)
  const firstParsed = parseWindow(first)
  const hasSlotsNow = firstParsed.days.some((day) => day.slots.length > 0)

  if (!hasSlotsNow && !first.next_slot_day) {
    return firstParsed.phoneOnly ? { kind: 'phone-only' } : { kind: 'none' }
  }

  const start = hasSlotsNow ? today : first.next_slot_day
  const days: ScheduleDay[] = []
  for (let offset = 0; offset < maxWindows; offset += windowBatch) {
    const starts = Array.from({ length: windowBatch }, (_, index) =>
      addDays(start, (offset + index) * daysPerWindow),
    )
    const batch = (
      await Promise.all(starts.map((day) => fetchWindow(day, reasonId)))
    ).flatMap((window) => parseWindow(window).days)
    days.push(...batch)
    const pastHorizon =
      addDays(starts[starts.length - 1], daysPerWindow) >
      addDays(today, observedHorizonDays)
    if (pastHorizon && !batch.some((day) => day.slots.length > 0)) break
  }

  let end = days.length
  while (end > 0 && days[end - 1].slots.length === 0) end -= 1
  return { kind: 'slots', days: days.slice(0, end) }
}

export type EarlyOpenings = {
  regularStart: string | null
  openings: { date: string; slot: Slot }[]
}

const regularSpanDays = 14
const regularMinOpenDays = 4
const earlyMarginDays = 7
const minimumUsualWaitDays = 21

export function findEarlyOpenings(
  days: ScheduleDay[],
  today: string,
): EarlyOpenings | null {
  const openDates = days
    .filter((day) => day.slots.length > 0)
    .map((day) => day.date)
  const regularStart =
    openDates.find(
      (date) =>
        openDates.filter(
          (other) => other >= date && other < addDays(date, regularSpanDays),
        ).length >= regularMinOpenDays,
    ) ?? null
  if (regularStart && daysBetween(today, regularStart) < minimumUsualWaitDays)
    return null

  const cutoff = regularStart
    ? addDays(regularStart, -earlyMarginDays)
    : addDays(today, minimumUsualWaitDays)
  const openings = days
    .filter((day) => day.date < cutoff)
    .flatMap((day) => day.slots.map((slot) => ({ date: day.date, slot })))
  return openings.length > 0 ? { regularStart, openings } : null
}

export function withoutPastSlots(days: ScheduleDay[], now = Date.now()) {
  return days.map((day) => ({
    ...day,
    slots: day.slots.filter((slot) => Date.parse(slot.start) > now),
  }))
}
