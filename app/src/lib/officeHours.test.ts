import { describe, expect, it } from 'vitest'
import { officeStatus, openHoursSummary, openingHoursSpecification } from './officeHours'

const mountain = (iso: string) => new Date(`${iso}-07:00`)

describe('office status in Mountain Time', () => {
  it('reports open with the closing time during hours', () => {
    expect(officeStatus(mountain('2026-11-10T09:15:00'))).toEqual({
      open: true,
      closesLabel: '4:30 PM',
    })
  })

  it('skips the Wednesday closure to the next open day', () => {
    expect(officeStatus(mountain('2026-11-11T10:00:00'))).toEqual({
      open: false,
      nextOpenLabel: 'tomorrow at 8:00 AM',
    })
  })

  it('points to Monday after Friday closing', () => {
    expect(officeStatus(mountain('2026-11-13T16:30:00'))).toEqual({
      open: false,
      nextOpenLabel: 'Monday at 8:00 AM',
    })
  })

  it('says today before opening time', () => {
    expect(officeStatus(mountain('2026-11-16T07:10:00'))).toEqual({
      open: false,
      nextOpenLabel: 'today at 8:00 AM',
    })
  })

  it('summarizes the weekly hours', () => {
    expect(openHoursSummary()).toBe('Mon, Tue, Thu, Fri, 8:00 AM – 4:30 PM')
  })

  it('publishes structured hours only for open days', () => {
    const days = openingHoursSpecification().map((entry) => [entry.dayOfWeek, entry.opens, entry.closes])
    expect(days).toEqual([
      ['Monday', '08:00', '16:30'],
      ['Tuesday', '08:00', '16:30'],
      ['Thursday', '08:00', '16:30'],
      ['Friday', '08:00', '16:30'],
    ])
  })
})
