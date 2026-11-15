import { describe, expect, it } from 'vite-plus/test'
import {
  describeFilter,
  openingMatches,
  parseAvoid,
  parseFilter,
  searchOpenings,
} from './appointmentSearch'
import { isoStart } from './nextPatientSchedule'

function opening(date: string, minutes: number) {
  return {
    date,
    slot: {
      id: '1',
      label: '',
      minutes,
      start: isoStart(date, minutes),
      href: '/p/1',
    },
  }
}

function searchTimes(avoid: unknown) {
  const date = '2027-01-11'
  const slots = [520, 540, 580, 590, 1010, 1020, 1030, 1080].map(
    (minutes) => opening(date, minutes).slot,
  )
  return searchOpenings(
    [{ date, slots }],
    parseFilter({ days: 'mon,fri', times: 'early-morning,late-afternoon' }),
    '2027-01-01',
    parseAvoid(avoid),
  )
}

describe('appointment search filter', () => {
  it('reads a plain-language request expressed as days and time bands', () => {
    const filter = parseFilter({
      days: 'Monday,fri,someday',
      times: ['late-afternoon', 'early-morning', 'noon'],
    })
    expect(filter).toEqual({
      days: ['mon', 'fri'],
      times: ['early-morning', 'late-afternoon'],
    })
    expect(describeFilter(filter)).toBe(
      'Mondays or Fridays, early morning or late afternoon',
    )
    expect(describeFilter(parseFilter({}))).toBe('Any day, any time')
  })

  it('excludes busy start times but keeps the end boundary and overall soonest', () => {
    const result = searchTimes('09:00-17:00')
    expect(result.matches.map(({ slot }) => slot.minutes)).toEqual([
      520, 1020, 1030, 1080,
    ])
    expect(result.soonest?.slot.minutes).toBe(520)
    expect(searchTimes('08:00-17:00').soonest?.slot.minutes).toBe(520)
  })

  it('accepts multiple busy ranges from API strings and tool arrays', () => {
    for (const avoid of [
      '09:00-17:00,17:10-18:00',
      ['09:00-17:00', '17:10-18:00'],
    ]) {
      expect(
        searchTimes(avoid).matches.map(({ slot }) => slot.minutes),
      ).toEqual([520, 1020, 1080])
    }
  })

  it('ignores malformed, empty, and reversed busy ranges', () => {
    const result = searchTimes([
      'bad',
      '9:00-17:00',
      '09:60-17:00',
      '09:00-24:00',
      '17:00-09:00',
      '09:00-09:00',
      '',
      '09:00-17:00',
    ])
    expect(result.matches.map(({ slot }) => slot.minutes)).toEqual([
      520, 1020, 1030, 1080,
    ])
    expect(searchTimes(undefined).matches).toHaveLength(8)
  })

  it('matches only openings on the chosen days and times', () => {
    const filter = parseFilter({
      days: 'mon,fri',
      times: 'early-morning,late-afternoon',
    })
    expect(openingMatches(opening('2027-01-11', 8 * 60 + 40), filter)).toBe(
      true,
    )
    expect(openingMatches(opening('2027-01-15', 14 * 60 + 50), filter)).toBe(
      true,
    )
    expect(openingMatches(opening('2027-01-15', 11 * 60 + 40), filter)).toBe(
      false,
    )
    expect(openingMatches(opening('2027-01-12', 8 * 60 + 40), filter)).toBe(
      false,
    )
  })
})
