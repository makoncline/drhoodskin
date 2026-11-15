import { drHoodVerified } from '../content/drHoodVerified'
import {
  describeFilter,
  parseAvoid,
  parseFilter,
  searchOpenings,
  weekdayOf,
  weekdays,
} from '../lib/appointmentSearch'
import type { Opening } from '../lib/appointmentSearch'
import {
  formatClock,
  isoToday,
  officialCalendarUrl,
  withoutPastSlots,
} from '../lib/nextPatientSchedule'
import { cachedAvailability } from './availabilityCache'
import type { CachedVisit } from './availabilityCache'

const content = drHoodVerified
const defaultLimit = 5
const maxLimit = 20
const minSlotsForHours = 10

export type AppointmentQuery = {
  visit?: unknown
  days?: unknown
  times?: unknown
  avoid?: unknown
  limit?: unknown
}

type AppointmentDay = {
  date: string
  weekday: string
  waitDays: number
  earlierThanUsual: boolean
  times: { time: string; start: string; bookingUrl: string }[]
}

function visitName(visit: CachedVisit) {
  return visit === 'office' ? 'office visit' : 'full-body skin exam'
}

export async function findAppointments(query: AppointmentQuery) {
  const visit: CachedVisit =
    query.visit === 'full-body-exam' ? 'full-body-exam' : 'office'
  const otherVisitType: CachedVisit =
    visit === 'office' ? 'full-body-exam' : 'office'
  const filter = parseFilter(query)
  const avoid = parseAvoid(query.avoid)
  const requestedLimit = Number(query.limit ?? defaultLimit)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(maxLimit, Math.max(1, Math.round(requestedLimit)))
    : defaultLimit
  const [{ availability: loaded, checkedAt }, other] = await Promise.all([
    cachedAvailability(visit),
    cachedAvailability(otherVisitType).catch(() => null),
  ])
  const today = isoToday()
  const scheduleDays =
    loaded.kind === 'slots' ? withoutPastSlots(loaded.days) : []
  const search = searchOpenings(scheduleDays, filter, today, avoid)
  const otherSearch = searchOpenings(
    other?.availability.kind === 'slots'
      ? withoutPastSlots(other.availability.days)
      : [],
    parseFilter({}),
    today,
  )
  const describe = ({ date, slot }: Opening, schedule = search) => ({
    date,
    weekday: weekdays.find((day) => day.code === weekdayOf(date))!.name,
    time: slot.label,
    start: slot.start,
    waitDays: schedule.waitDays(date),
    earlierThanUsual: schedule.isEarlier(date),
    bookingUrl: slot.href,
  })
  const slots = scheduleDays.flatMap((day) => day.slots)
  const hours =
    slots.length >= minSlotsForHours
      ? {
          firstTime: formatClock(
            slots.reduce((first, slot) => Math.min(first, slot.minutes), 1440),
          ),
          lastTime: formatClock(
            slots.reduce((last, slot) => Math.max(last, slot.minutes), 0),
          ),
          weekdays: weekdays
            .filter((weekday) =>
              scheduleDays.some(
                (day) =>
                  day.slots.length > 0 && weekdayOf(day.date) === weekday.code,
              ),
            )
            .map((day) => day.name),
        }
      : null
  const days: AppointmentDay[] = []
  for (const opening of search.matches) {
    const { time, start, bookingUrl, ...day } = describe(opening)
    const previous = days.at(-1)
    const timeOption = { time, start, bookingUrl }
    if (previous?.date === day.date) previous.times.push(timeOption)
    else days.push({ ...day, times: [timeOption] })
  }

  return {
    doctor: content.identity.name,
    office: `${content.office.name}, ${content.office.address1}, ${content.office.city}, ${content.office.state}`,
    visit,
    timeZone: 'America/Denver',
    checkedAt: new Date(checkedAt).toISOString(),
    filter: {
      ...filter,
      summary: `${describeFilter(filter)}${avoid.length ? ', outside the requested busy hours' : ''}`,
    },
    call: {
      phone: content.office.phoneDisplay,
      phoneHref: content.office.phoneHref,
      callbackRequest: content.booking.callbackHref,
    },
    officialCalendar: officialCalendarUrl,
    status: search.soonest ? ('open' as const) : ('call-to-schedule' as const),
    message: search.soonest
      ? null
      : `No ${visitName(visit)} times with Dr. Hood are open online right now. Call ${content.office.phoneDisplay} for the next opening.`,
    usualFirstOpening: search.usualFirstOpening,
    soonest: search.soonest ? describe(search.soonest) : null,
    days: days.slice(0, limit),
    totalMatches: search.matches.length,
    totalDays: days.length,
    hours,
    otherVisit: {
      visit: otherVisitType,
      status: !other
        ? 'unknown'
        : otherSearch.soonest
          ? 'open'
          : 'call-to-schedule',
      soonest: otherSearch.soonest
        ? describe(otherSearch.soonest, otherSearch)
        : null,
    },
    instructions:
      'A full-body skin exam needs a full-body slot. Never offer an office-visit time for a full-body exam. An office visit is for a specific concern. Confirm the visit type and time with the patient. Give booking links to the patient; do not open them. The patient completes booking on the official U.S. Dermatology Partners page. Times are Mountain Time. If nothing fits, or the patient needs care sooner, call the office.',
  }
}

export async function findAppointmentsTool(args: AppointmentQuery | undefined) {
  try {
    const result = await findAppointments(args ?? {})
    const text = []
    if (result.status === 'call-to-schedule') text.push(result.message)
    else if (result.days.length) {
      text.push(
        `${result.totalMatches} open times across ${result.totalDays} days fit (${result.filter.summary}). First matching days, Mountain Time:`,
        ...result.days
          .slice(0, 3)
          .map(
            (day) =>
              `${day.weekday}, ${day.date}: ${day.times.map((time) => `${time.time}: ${time.bookingUrl}`).join('; ')}`,
          ),
      )
    } else {
      text.push(
        [
          `No open times fit (${result.filter.summary}).`,
          result.hours
            ? `Open ${visitName(result.visit)} times run from ${result.hours.firstTime} to ${result.hours.lastTime} Mountain Time on ${result.hours.weekdays.join(', ')}.`
            : null,
          result.soonest
            ? `Soonest at any time: ${result.soonest.weekday}, ${result.soonest.date} at ${result.soonest.time}: ${result.soonest.bookingUrl}.`
            : null,
          `Call ${result.call.phone} if nothing fits.`,
        ]
          .filter(Boolean)
          .join(' '),
      )
    }
    const other = result.otherVisit
    if (
      other.soonest &&
      (!result.soonest ||
        Date.parse(other.soonest.start) < Date.parse(result.soonest.start))
    ) {
      text.push(
        `The other visit type, ${visitName(other.visit)}, has an unfiltered opening on ${other.soonest.weekday}, ${other.soonest.date} at ${other.soonest.time} Mountain Time: ${other.soonest.bookingUrl}. It may not fit the patient's schedule.`,
      )
    }
    text.push(result.instructions)
    return {
      content: [{ type: 'text' as const, text: text.join('\n') }],
      structuredContent: result,
    }
  } catch {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Open times could not be loaded right now. Give the official calendar link (${officialCalendarUrl}) to the patient; do not open it. Confirm the visit type and choice with the patient. A full-body skin exam needs a full-body slot, not an office-visit time. An office visit is for a specific concern. Call ${content.office.phoneDisplay} for help.`,
        },
      ],
      isError: true,
    }
  }
}
