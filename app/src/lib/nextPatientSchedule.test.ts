import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  findEarlyOpenings,
  isoStart,
  isoToday,
  loadAvailability,
  withoutPastSlots,
} from './nextPatientSchedule'
import type { ScheduleDay } from './nextPatientSchedule'

const today = '2026-11-16'

function day(date: string, times: number[]): ScheduleDay {
  return {
    date,
    slots: times.map((minutes, index) => ({
      id: `${date}-${index}`,
      label: String(minutes),
      minutes,
      start: isoStart(date, minutes),
      href: `/p/5596/${date}-${index}/appt-book`,
    })),
  }
}

const regular = Array.from({ length: 28 }, (_, index) => {
  const date = addDays('2027-01-11', index)
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day(date, [1, 2, 4, 5].includes(weekday) ? [520, 530] : [])
})

describe('early openings', () => {
  it('flags cancellations well ahead of the usual wait', () => {
    const early = findEarlyOpenings(
      [day('2026-11-19', [600]), day('2026-11-20', []), ...regular],
      today,
    )
    expect(early?.regularStart).toBe('2027-01-11')
    expect(early?.openings.map((opening) => opening.date)).toEqual([
      '2026-11-19',
    ])
  })

  it('stays quiet when the schedule simply starts at the usual wait', () => {
    expect(findEarlyOpenings(regular, today)).toBeNull()
  })

  it('stays quiet when the usual wait is already short', () => {
    expect(
      findEarlyOpenings([day('2026-11-17', [600]), ...regular], '2027-01-01'),
    ).toBeNull()
  })

  it('flags a near opening when times are otherwise scarce', () => {
    const early = findEarlyOpenings(
      [day('2026-11-18', [870]), day('2027-01-20', [600])],
      today,
    )
    expect(early?.regularStart).toBeNull()
    expect(early?.openings.map((opening) => opening.date)).toEqual([
      '2026-11-18',
    ])
  })

  it('does not count an opening just before regular availability as early', () => {
    expect(
      findEarlyOpenings([day('2027-01-07', [600]), ...regular], today),
    ).toBeNull()
  })
})

describe('schedule safety', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('drops times that have already started', () => {
    const [open] = withoutPastSlots(
      [day('2027-01-15', [520, 600])],
      Date.parse('2027-01-15T09:00:00-07:00'),
    )
    expect(open.slots.map((slot) => slot.minutes)).toEqual([600])
  })

  it('turns booking links into absolute NextPatient links and drops off-site links', async () => {
    const startDay = isoToday()
    const cells = [
      '<a class="nextpatient-slot-time" href="/p/5596/111/appt-book?reason_id=56487">8:40am</a>',
      '<a class="nextpatient-slot-time" href="https://example.com/p/5596/222/appt-book">8:50am</a>',
      '',
    ].map((links) => `<td class="nextpatient-schedule-day-slots">${links}</td>`)
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const requested = new URL(url).searchParams.get('day') ?? startDay
        const html =
          requested === startDay
            ? `<table><tr>${cells.join('')}</tr></table>`
            : '<table><tr><td class="nextpatient-schedule-day-slots nextpatient-schedule-next-available" colspan=3>First available</td></tr></table>'
        return Promise.resolve(
          new Response(
            JSON.stringify({ html, day: requested, next_slot_day: '' }),
          ),
        )
      }),
    )
    const availability = await loadAvailability(56487)
    const slots =
      availability.kind === 'slots'
        ? availability.days.flatMap((entry) => entry.slots)
        : []
    expect(slots.map((slot) => slot.href)).toEqual([
      'https://nextpatient.co/p/5596/111/appt-book?reason_id=56487',
    ])
  })

  it('treats an unrecognized scheduler page as a failure, not an empty schedule', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              html: '<p>Down for maintenance</p>',
              day: '2026-11-16',
              next_slot_day: '',
            }),
          ),
        ),
      ),
    )
    await expect(loadAvailability(56487)).rejects.toThrow(
      'Unrecognized scheduler response',
    )
  })
})
