const nextPatientOrigin = 'https://nextpatient.co'
const practiceId = '5596'
const entityId = '60744'
const officeTimeZone = 'America/Denver'
const daysPerWindow = 3
const windowBatch = 6
const requestTimeoutMs = 8000
const observedHorizonDays = 92
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: officeTimeZone })
const offsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: officeTimeZone,
  timeZoneName: 'longOffset',
})

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

export function isoToday() {
  return dayFormatter.format(new Date())
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000,
  )
}

export function formatClock(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minutes % 60).padStart(2, '0')} ${suffix}`
}

function parseClock(label: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(label.trim())
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2]) > 59) return null
  const hour = (Number(match[1]) % 12) + (match[3].toLowerCase() === 'pm' ? 12 : 0)
  return hour * 60 + Number(match[2])
}

function offsetFor(date: string, minutes: number) {
  const probe = new Date(`${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:00:00Z`)
  const name = offsetFormatter
    .formatToParts(probe)
    .find((part) => part.type === 'timeZoneName')?.value
  return name?.replace('GMT', '') || '+00:00'
}

export function isoStart(date: string, minutes: number) {
  const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return `${date}T${clock}:00${offsetFor(date, minutes)}`
}

async function fetchWindow(day: string, reasonId: number): Promise<WindowResponse> {
  const url = `https://nextpatient.co/p/${practiceId}/schedule.json?day=${day}&reason_id=${reasonId}&entity_id=${entityId}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(requestTimeoutMs),
  })
  if (!response.ok) throw new Error(`Schedule request failed (${response.status})`)
  const result = (await response.json()) as WindowResponse
  if (
    !result ||
    typeof result.html !== 'string' ||
    result.day !== day ||
    typeof result.next_slot_day !== 'string' ||
    (result.next_slot_day !== '' && !isIsoDay(result.next_slot_day))
  )
    throw new Error('Unrecognized scheduler response')
  return result
}

function isIsoDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && addDays(day, 0) === day
  )
}

function decodeText(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
    (entity, code: string) => {
      if (code[0] === '#') {
        const point =
          code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
      }
      return (
        { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' } as Record<string, string>
      )[code.toLowerCase()]
    },
  )
}

function attribute(tag: string, name: string) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(
    tag,
  )
  return decodeText(match?.[1] ?? match?.[2] ?? match?.[3] ?? '')
}

function hasClass(tag: string, name: string) {
  return attribute(tag, 'class').split(/\s+/).includes(name)
}

function parseWindow(window: WindowResponse) {
  const phoneOnly = /please call|call to schedule/i.test(window.html.replace(/<[^>]*>/g, ' '))
  const days: ScheduleDay[] = []
  let recognized = phoneOnly
  let slotLinks = false
  for (const link of window.html.matchAll(/<a\b([^>]*)>/gi)) {
    if (hasClass(link[1], 'nextpatient-slot-time')) {
      slotLinks = true
      break
    }
  }
  for (const cell of window.html.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td\s*>/gi)) {
    if (!hasClass(cell[1], 'nextpatient-schedule-day-slots')) continue
    recognized = true
    if (hasClass(cell[1], 'nextpatient-schedule-next-available')) continue
    const date = addDays(window.day, days.length)
    const slots: Slot[] = []
    let offset: string | undefined
    for (const link of cell[2].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
      if (!hasClass(link[1], 'nextpatient-slot-time')) continue
      const minutes = parseClock(decodeText(link[2].replace(/<[^>]*>/g, '')))
      const target = attribute(link[1], 'href')
      if (minutes === null || !URL.canParse(target, nextPatientOrigin)) continue
      const url = new URL(target, nextPatientOrigin)
      const id = /^\/p\/5596\/(\d+)\/appt-book(?:\/|$)/.exec(url.pathname)?.[1]
      if (!id || url.origin !== nextPatientOrigin) continue
      offset ??= offsetFor(date, 12 * 60)
      const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
      slots.push({
        id,
        label: formatClock(minutes),
        minutes,
        start: `${date}T${clock}:00${offset}`,
        href: url.toString(),
      })
    }
    days.push({ date, slots })
  }
  if (!recognized) throw new Error('Unrecognized scheduler response')
  if (slotLinks && !days.some((day) => day.slots.length > 0))
    throw new Error('Unrecognized scheduler slots')
  return { days, phoneOnly }
}

export async function loadAvailability(reasonId: number): Promise<Availability> {
  const today = isoToday()
  const first = await fetchWindow(today, reasonId)
  const firstParsed = parseWindow(first)
  const hasSlotsNow = firstParsed.days.some((day) => day.slots.length > 0)

  if (!hasSlotsNow && !first.next_slot_day) {
    return firstParsed.phoneOnly ? { kind: 'phone-only' } : { kind: 'none' }
  }

  const nextWindow = addDays(today, daysPerWindow)
  const start = !hasSlotsNow && first.next_slot_day > nextWindow ? first.next_slot_day : nextWindow
  const horizon = addDays(today, observedHorizonDays)
  const starts: string[] = []
  for (let day = start; day <= horizon; day = addDays(day, daysPerWindow)) starts.push(day)
  const days = [...firstParsed.days]
  for (let offset = 0; offset < starts.length; offset += windowBatch) {
    const batch = await Promise.allSettled(
      starts
        .slice(offset, offset + windowBatch)
        .map(async (day) => parseWindow(await fetchWindow(day, reasonId))),
    )
    for (const result of batch) {
      if (result.status === 'rejected') throw result.reason
      days.push(...result.value.days)
    }
  }
  const inHorizon = days.filter((day) => day.date <= horizon)
  let end = inHorizon.length
  while (end > 0 && inHorizon[end - 1].slots.length === 0) end -= 1
  return end > 0 ? { kind: 'slots', days: inHorizon.slice(0, end) } : { kind: 'none' }
}

export type EarlyOpenings = {
  regularStart: string | null
  openings: { date: string; slot: Slot }[]
}

const regularSpanDays = 14
const regularMinOpenDays = 4
const earlyMarginDays = 7
const minimumUsualWaitDays = 21

export function findEarlyOpenings(days: ScheduleDay[], today: string): EarlyOpenings | null {
  const openDates = days.filter((day) => day.slots.length > 0).map((day) => day.date)
  const regularStart =
    openDates.find(
      (date) =>
        openDates.filter((other) => other >= date && other < addDays(date, regularSpanDays))
          .length >= regularMinOpenDays,
    ) ?? null
  if (regularStart && daysBetween(today, regularStart) < minimumUsualWaitDays) return null

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
