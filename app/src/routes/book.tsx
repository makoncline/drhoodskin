import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Phone,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
import { drHoodVerified } from '../content/drHoodVerified'
import { trackEvent } from '../lib/analytics'
import { OfficeStatus } from '../components/OfficeStatus'
import { SiteFooter, SiteHeader } from '../components/SiteChrome'
import {
  avoidParam,
  describeFilter,
  isFiltered,
  parseAvoid,
  parseFilter,
  searchOpenings,
  timeBands,
  weekdayOf,
  weekdays,
} from '../lib/appointmentSearch'
import type {
  AppointmentFilter,
  Opening,
  TimeBandId,
  WeekdayCode,
} from '../lib/appointmentSearch'
import {
  addDays,
  daysBetween,
  formatClock,
  isoToday,
  withoutPastSlots,
} from '../lib/nextPatientSchedule'
import type { ScheduleDay, Slot } from '../lib/nextPatientSchedule'
import { registerWebMcpTools } from '../lib/webMcp'
import { getSchedulerData } from '../server/schedulerData'

const content = drHoodVerified

type Visit = 'office' | 'exam'
type SchedulerSearch = {
  visit?: 'exam'
  days?: string
  times?: string
  avoid?: string
}

export const Route = createFileRoute('/book')({
  validateSearch: (search: Record<string, unknown>): SchedulerSearch => {
    const filter = parseFilter(search)
    return {
      visit: search.visit === 'exam' ? 'exam' : undefined,
      days: filter.days.length > 0 ? filter.days.join(',') : undefined,
      times: filter.times.length > 0 ? filter.times.join(',') : undefined,
      avoid: normalizeAvoid(search.avoid).join(',') || undefined,
    }
  },
  loader: () => getSchedulerData({ data: {} }),
  shouldReload: false,
  pendingComponent: LoadingState,
  head: () => {
    const title = 'Book with Dr. Hood · Golden dermatology'
    const description =
      'Open appointment times with board-certified dermatologist Dr. Channing Hood at U.S. Dermatology Partners Golden. Pick a time and confirm on the official booking page.'
    const url = new URL('/book', content.seo.canonical).toString()
    const image = new URL(
      content.identity.shareImageSrc,
      content.seo.canonical,
    ).toString()
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { name: 'theme-color', content: '#f7f5f2' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Book with Dr. Hood' },
        { property: 'og:description', content: description },
        { property: 'og:url', content: url },
        { property: 'og:site_name', content: content.identity.name },
        { property: 'og:image', content: image },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: content.identity.name },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Book with Dr. Hood' },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: image },
      ],
      links: [{ rel: 'canonical', href: url }],
    }
  },
  component: SchedulerConcept,
})

type Loaded = Awaited<ReturnType<typeof getSchedulerData>>
type VisitData = Loaded['office']

const visitLabels: Record<Visit, string> = {
  office: 'Office visit',
  exam: 'Full-body skin exam',
}
const collapseGapAfter = 5
const minSlotsForHours = 10
const pickerDays = weekdays.filter((day) => day.index >= 1 && day.index <= 5)
type PageFilter = AppointmentFilter & { avoid: string[] }
const noFilter: PageFilter = { days: [], times: [], avoid: [] }

function normalizeAvoid(input: unknown) {
  return avoidParam(parseAvoid(input))
}

function hasFilter(filter: PageFilter) {
  return isFiltered(filter) || filter.avoid.length > 0
}

function describeAvoid(avoid: string[]) {
  return parseAvoid(avoid)
    .map((range) => `${formatClock(range.from)} to ${formatClock(range.to)}`)
    .join(', ')
}

function describePageFilter(filter: PageFilter) {
  const base = describeFilter(filter)
  return filter.avoid.length > 0
    ? `${base}, not ${describeAvoid(filter.avoid)}`
    : base
}

function live(data: VisitData): VisitData {
  if (!data || data.availability.kind !== 'slots') return data
  const days = withoutPastSlots(data.availability.days)
  return days.some((day) => day.slots.length > 0)
    ? { ...data, availability: { kind: 'slots', days } }
    : { ...data, availability: { kind: 'none' } }
}

function formatDate(iso: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`))
}

const longDate = (iso: string) =>
  formatDate(iso, { weekday: 'long', month: 'long', day: 'numeric' })
const shortDate = (iso: string) =>
  formatDate(iso, { weekday: 'short', month: 'short', day: 'numeric' })

function waitPhrase(days: number) {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  return `in about ${Math.round(days / 7)} weeks`
}

function openDays(data: VisitData) {
  return data?.availability.kind === 'slots' ? data.availability.days : []
}

function soonestOf(data: VisitData): Opening | null {
  for (const day of openDays(data)) {
    const slot = day.slots.at(0)
    if (slot) return { date: day.date, slot }
  }
  return null
}

function hoursOf(days: ScheduleDay[]) {
  const minutes = days.flatMap((day) => day.slots.map((slot) => slot.minutes))
  if (minutes.length < minSlotsForHours) return null
  return {
    first: formatClock(Math.min(...minutes)),
    last: formatClock(Math.max(...minutes)),
  }
}

function SchedulerConcept() {
  const fromServer = Route.useLoaderData()
  const loaded = useMemo(
    () => ({ office: live(fromServer.office), exam: live(fromServer.exam) }),
    [fromServer],
  )
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const visit: Visit = search.visit ?? 'office'
  const filter = useMemo<PageFilter>(
    () => ({ ...parseFilter(search), avoid: normalizeAvoid(search.avoid) }),
    [search],
  )
  const data = visit === 'office' ? loaded.office : loaded.exam
  const other = visit === 'office' ? loaded.exam : loaded.office

  const update = (change: Partial<SchedulerSearch>) =>
    void navigate({
      search: (current) => ({ ...current, ...change }),
      replace: true,
      resetScroll: false,
    })
  const setFilter = (next: PageFilter) => {
    trackEvent('book_filter_change')
    update({
      days: next.days.length > 0 ? next.days.join(',') : undefined,
      times: next.times.length > 0 ? next.times.join(',') : undefined,
      avoid: next.avoid.length > 0 ? next.avoid.join(',') : undefined,
    })
  }
  const setVisit = (value: Visit) => {
    trackEvent('book_visit_switch')
    update({ visit: value === 'exam' ? 'exam' : undefined })
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      await getSchedulerData({ data: { fresh: true } })
      await router.invalidate()
    } finally {
      setRefreshing(false)
    }
  }

  const staleOnArrival = useRef(
    [loaded.office, loaded.exam].some(
      (entry) => !entry || Date.now() - entry.checkedAt > 2 * 60_000,
    ),
  )
  useEffect(() => {
    if (staleOnArrival.current) void refresh()
  }, [])

  const page = useRef({ setFilter, setVisit, loaded })
  page.current = { setFilter, setVisit, loaded }
  useEffect(
    () =>
      registerWebMcpTools([
        {
          name: 'show_matching_times',
          title: 'Show matching times on this page',
          description:
            'Set the visit type and the patient’s days and times on this booking page so the patient sees matching open times. Returns the soonest matching time.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              visit: { type: 'string', enum: ['office', 'full-body-exam'] },
              days: {
                type: 'array',
                items: {
                  enum: weekdays.map((day) => day.code),
                  type: 'string',
                },
              },
              times: {
                type: 'array',
                items: {
                  enum: timeBands.map((band) => band.id),
                  type: 'string',
                },
              },
              avoid: {
                type: 'array',
                description:
                  'Busy ranges to hide, Mountain Time, 24-hour "HH:MM-HH:MM", for example "09:00-17:00".',
                items: { type: 'string' },
              },
            },
          },
          execute: (input) => {
            const nextVisit: Visit =
              input?.visit === 'full-body-exam' ? 'exam' : 'office'
            const nextFilter: PageFilter = {
              ...parseFilter(input ?? {}),
              avoid: normalizeAvoid(input?.avoid),
            }
            page.current.setVisit(nextVisit)
            page.current.setFilter(nextFilter)
            const source =
              nextVisit === 'office'
                ? page.current.loaded.office
                : page.current.loaded.exam
            const found = searchOpenings(
              openDays(source),
              nextFilter,
              isoToday(),
              parseAvoid(nextFilter.avoid),
            ).matches.at(0)
            return Promise.resolve({
              shown: describePageFilter(nextFilter),
              soonestMatch: found
                ? {
                    date: found.date,
                    time: found.slot.label,
                    bookingUrl: found.slot.href,
                  }
                : null,
            })
          },
        },
      ]),
    [],
  )

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader showBooking={false} />

      <main className="shell max-w-3xl py-6 md:py-10">
        <Intro />
        <VisitPicker
          visit={visit}
          next={{
            office: soonestOf(loaded.office),
            exam: soonestOf(loaded.exam),
          }}
          onChange={setVisit}
        />

        {data === null ? <ErrorState onRetry={refresh} /> : null}
        {data !== null && data.availability.kind !== 'slots' ? (
          <CallToSchedule visit={visit} />
        ) : null}
        {data !== null && data.availability.kind === 'slots' ? (
          <>
            <AvailabilityPanel
              filter={filter}
              hours={hoursOf(data.availability.days)}
              onChange={setFilter}
            />
            <OpenTimes
              key={visit}
              visit={visit}
              days={data.availability.days}
              filter={filter}
              otherSoonest={soonestOf(other)}
              onClearFilter={() => setFilter(noFilter)}
              onSwitchVisit={() =>
                setVisit(visit === 'office' ? 'exam' : 'office')
              }
            />
          </>
        ) : null}
        {data !== null ? (
          <CheckedAt
            checkedAt={data.checkedAt}
            refreshing={refreshing}
            onRefresh={refresh}
          />
        ) : null}
      </main>
      <SiteFooter />
    </div>
  )
}

function Intro() {
  return (
    <header className="flex items-center gap-3.5">
      <div className="frame shrink-0 p-[3px]">
        <img
          src={content.identity.headshotSrc}
          alt=""
          width={693}
          height={780}
          className="block h-16 w-14 object-cover"
        />
      </div>
      <div className="min-w-0">
        <h1 className="m-0 font-display text-[clamp(1.7rem,5vw,2.4rem)] leading-tight font-normal">
          Book with Dr. Hood
        </h1>
        <p className="m-0 text-[0.98rem] leading-snug text-ink-muted">
          Board-certified dermatologist in Golden. New patients, adults and
          children.{' '}
          <a href="/" className="text-link">
            About
          </a>{' '}
          ·{' '}
          <a href="/#first-visit" className="text-link">
            Insurance
          </a>
        </p>
      </div>
    </header>
  )
}

function VisitPicker({
  visit,
  next,
  onChange,
}: {
  visit: Visit
  next: Record<Visit, Opening | null>
  onChange: (value: Visit) => void
}) {
  const options: { value: Visit; detail: string }[] = [
    { value: 'office', detail: 'A specific spot or skin concern' },
    { value: 'exam', detail: 'Head-to-toe check, longer visit' },
  ]
  return (
    <fieldset className="m-0 mt-5 border-0 p-0">
      <legend className="sr-only">Type of visit</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = visit === option.value
          const soonest = next[option.value]
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col rounded-xl border px-3.5 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action ${
                selected
                  ? 'border-action bg-action-tint text-ink shadow-[inset_0_0_0_1px_var(--color-action)]'
                  : 'border-rule bg-card text-ink hover:border-action'
              }`}
            >
              <input
                type="radio"
                name="visit-type"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="leading-snug font-semibold">
                {visitLabels[option.value]}
              </span>
              <span className="text-sm leading-snug text-ink-muted">
                {option.detail}
              </span>
              <span className="mt-1 text-sm font-semibold text-ink">
                {soonest
                  ? `Next: ${shortDate(soonest.date)}`
                  : 'Call to schedule'}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function Chip({
  pressed,
  onClick,
  label,
  sublabel,
}: {
  pressed: boolean
  onClick: () => void
  label: string
  sublabel?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex min-h-11 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-colors ${
        pressed
          ? 'border-action bg-action-tint text-ink shadow-[inset_0_0_0_1px_var(--color-action)]'
          : 'border-rule bg-card text-ink-muted hover:border-action'
      }`}
    >
      <span className="flex items-center gap-1 font-semibold">
        {pressed ? (
          <Check
            aria-hidden="true"
            className="h-3.5 w-3.5 text-action"
            strokeWidth={3}
          />
        ) : null}
        {label}
      </span>
      {sublabel ? (
        <span className="text-xs text-ink-muted">{sublabel}</span>
      ) : null}
    </button>
  )
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item)
    ? list.filter((value) => value !== item)
    : [...list, item]
}

function AvailabilityPanel({
  filter,
  hours,
  onChange,
}: {
  filter: PageFilter
  hours: { first: string; last: string } | null
  onChange: (filter: PageFilter) => void
}) {
  const filtered = hasFilter(filter)
  const [open, setOpen] = useState(filtered)
  return (
    <section
      aria-label="When can you come in?"
      className="mt-4 rounded-xl border border-rule bg-card px-4 sm:px-5"
    >
      <div className="flex min-h-13 items-center gap-2 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="availability-options"
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink-muted">
              When can you come in?
            </span>
            <span className="block truncate font-semibold">
              {describePageFilter(filter)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-action">
            {filtered ? 'Change' : 'Choose'}
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
        {filtered ? (
          <button
            type="button"
            onClick={() => onChange(noFilter)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border-l border-rule pr-1 pl-3 text-sm font-semibold text-action hover:underline"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Reset
          </button>
        ) : null}
      </div>
      <div id="availability-options" hidden={!open} className="pb-4">
        <div
          className="grid grid-cols-5 gap-1.5"
          role="group"
          aria-label="Days"
        >
          {pickerDays.map((day) => (
            <Chip
              key={day.code}
              label={day.name.slice(0, 3)}
              pressed={filter.days.includes(day.code)}
              onClick={() =>
                onChange({
                  ...filter,
                  days: toggle<WeekdayCode>(filter.days, day.code),
                })
              }
            />
          ))}
        </div>
        <div
          className="mt-2 grid grid-cols-2 gap-1.5"
          role="group"
          aria-label="Times"
        >
          {timeBands.map((band) => (
            <Chip
              key={band.id}
              label={band.label}
              sublabel={band.range}
              pressed={filter.times.includes(band.id)}
              onClick={() =>
                onChange({
                  ...filter,
                  times: toggle<TimeBandId>(filter.times, band.id),
                })
              }
            />
          ))}
        </div>
        {filter.avoid.length > 0 ? (
          <p className="mt-2 mb-0 flex items-center justify-between gap-3 rounded-lg bg-action-tint px-3 py-2 text-sm">
            <span>Busy {describeAvoid(filter.avoid)}</span>
            <button
              type="button"
              onClick={() => onChange({ ...filter, avoid: [] })}
              className="shrink-0 font-semibold text-action hover:underline"
            >
              Remove
            </button>
          </p>
        ) : null}
        <p className="mt-3 mb-0 text-sm text-ink-muted">
          Pick none to see every time.
          {hours
            ? ` Dr. Hood’s times run ${hours.first} to ${hours.last}.`
            : ''}
        </p>
      </div>
    </section>
  )
}

type DayGroup = { date: string; slots: Slot[] }
type SearchResult = ReturnType<typeof searchOpenings>

function groupByDay(openings: Opening[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const opening of openings) {
    const last = groups.at(-1)
    if (last?.date === opening.date) last.slots.push(opening.slot)
    else groups.push({ date: opening.date, slots: [opening.slot] })
  }
  return groups
}

function OpenTimes({
  visit,
  days,
  filter,
  otherSoonest,
  onClearFilter,
  onSwitchVisit,
}: {
  visit: Visit
  days: ScheduleDay[]
  filter: PageFilter
  otherSoonest: Opening | null
  onClearFilter: () => void
  onSwitchVisit: () => void
}) {
  const today = useMemo(() => isoToday(), [])
  const search = useMemo(
    () => searchOpenings(days, filter, today, parseAvoid(filter.avoid)),
    [days, filter, today],
  )
  const matchingDays = useMemo(
    () => groupByDay(search.matches),
    [search.matches],
  )
  const [selected, setSelected] = useState<string | null>(null)
  const day =
    matchingDays.find((group) => group.date === selected) ?? matchingDays.at(0)
  const thisSoonest = search.soonest
  const otherIsSooner =
    otherSoonest !== null &&
    (thisSoonest === null || otherSoonest.date < thisSoonest.date)

  return (
    <>
      {day ? (
        <>
          <DateStrip
            days={days}
            matchingDays={matchingDays}
            selected={day.date}
            search={search}
            onSelect={setSelected}
          />
          <DayCard
            day={day}
            search={search}
            filter={filter}
            isSoonest={day.date === matchingDays[0].date}
          />
        </>
      ) : (
        <NoMatch
          filter={filter}
          soonest={thisSoonest}
          today={today}
          onClearFilter={onClearFilter}
        />
      )}
      {otherIsSooner && visit === 'office' ? (
        <SwitchNote
          text={`A full-body skin exam is open sooner: ${longDate(otherSoonest.date)} at ${otherSoonest.slot.label}. It is a longer, head-to-toe visit.`}
          action="See full-body time"
          onClick={onSwitchVisit}
        />
      ) : null}
      {visit === 'exam' && otherSoonest ? (
        <SwitchNote
          text={`Only one spot to check? Office visits start ${longDate(otherSoonest.date)}.`}
          action="See office visits"
          onClick={onSwitchVisit}
        />
      ) : null}
      <OtherOptions visit={visit} />
    </>
  )
}

type StripItem =
  | { kind: 'day'; date: string; count: number }
  | { kind: 'gap'; from: string; to: string; full: boolean }

function stripItems(
  days: ScheduleDay[],
  matchingDays: DayGroup[],
): StripItem[] {
  const first = days.find((day) => day.slots.length > 0)?.date
  const last = days.at(-1)?.date
  if (!first || !last) return []
  const openDates = new Set(
    days.filter((day) => day.slots.length > 0).map((day) => day.date),
  )
  const counts = new Map(
    matchingDays.map((day) => [day.date, day.slots.length]),
  )
  const items: StripItem[] = []
  let closed: string[] = []
  const flush = () => {
    if (closed.length > collapseGapAfter)
      items.push({
        kind: 'gap',
        from: closed[0],
        to: closed[closed.length - 1],
        full: closed.every((date) => !openDates.has(date)),
      })
    else
      items.push(
        ...closed.map((date) => ({ kind: 'day' as const, date, count: 0 })),
      )
    closed = []
  }
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const count = counts.get(date) ?? 0
    if (count > 0) {
      flush()
      items.push({ kind: 'day', date, count })
    } else if (!['sat', 'sun'].includes(weekdayOf(date))) {
      closed.push(date)
    }
  }
  flush()
  return items
}

function DateStrip({
  days,
  matchingDays,
  selected,
  search,
  onSelect,
}: {
  days: ScheduleDay[]
  matchingDays: DayGroup[]
  selected: string
  search: SearchResult
  onSelect: (date: string) => void
}) {
  const items = useMemo(
    () => stripItems(days, matchingDays),
    [days, matchingDays],
  )
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scroller.current
    const chip = container?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!container || !chip) return
    const left = chip.offsetLeft - container.offsetLeft
    const visible =
      left >= container.scrollLeft &&
      left + chip.offsetWidth <= container.scrollLeft + container.clientWidth
    if (!visible) container.scrollLeft = left - 16
  }, [selected])

  let month = ''
  return (
    <section
      aria-label="Choose a date. Use the arrow keys to move between dates."
      className="mt-4"
    >
      <div
        ref={scroller}
        className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-1.5 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {items.map((item) => {
          if (item.kind === 'gap') {
            const weeks = Math.max(
              1,
              Math.round((daysBetween(item.from, item.to) + 1) / 7),
            )
            return (
              <div
                key={`gap-${item.from}`}
                className="flex shrink-0 items-center px-2 text-sm whitespace-nowrap text-ink-muted"
              >
                {weeks} {weeks === 1 ? 'week' : 'weeks'}{' '}
                {item.full ? 'full' : 'with no matching times'}
              </div>
            )
          }
          const newMonth = item.date.slice(0, 7) !== month
          month = item.date.slice(0, 7)
          const number = newMonth
            ? formatDate(item.date, { month: 'short', day: 'numeric' })
            : String(Number(item.date.slice(8)))
          const weekday = formatDate(item.date, { weekday: 'short' })
          if (item.count === 0) {
            return (
              <div
                key={item.date}
                aria-hidden="true"
                className="flex w-12 shrink-0 flex-col items-center justify-center py-2 text-ink-muted/50"
              >
                <span className="text-xs">{weekday}</span>
                <span className="text-sm whitespace-nowrap tabular-nums">
                  {number}
                </span>
              </div>
            )
          }
          const active = item.date === selected
          const earlier = search.isEarlier(item.date)
          return (
            <button
              key={item.date}
              type="button"
              aria-pressed={active}
              aria-label={`${longDate(item.date)}: ${item.count} ${item.count === 1 ? 'time' : 'times'}${earlier ? ', earlier than usual' : ''}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(item.date)}
              onKeyDown={(event) => {
                const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
                if (!step) return
                event.preventDefault()
                const buttons = [
                  ...(scroller.current?.querySelectorAll('button') ?? []),
                ]
                const next = buttons[
                  buttons.indexOf(event.currentTarget) + step
                ] as HTMLButtonElement | undefined
                if (next) {
                  next.focus()
                  next.click()
                }
              }}
              className={`flex min-w-[4.25rem] shrink-0 snap-start flex-col items-center justify-center rounded-xl border px-2 py-2 transition-colors ${
                active
                  ? 'border-action bg-action text-white'
                  : 'border-rule bg-card text-ink hover:border-action'
              } ${earlier && !active ? 'ring-2 ring-night ring-offset-1 ring-offset-paper' : ''}`}
            >
              <span
                className={`text-xs font-semibold ${active ? 'text-white/80' : 'text-ink-muted'}`}
              >
                {weekday}
              </span>
              <span className="text-base font-semibold whitespace-nowrap tabular-nums">
                {number}
              </span>
              <span
                className={`text-xs ${active ? 'text-white/80' : 'text-ink-muted'}`}
              >
                {item.count} {item.count === 1 ? 'time' : 'times'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TimeButton({
  date,
  slot,
  tone,
}: {
  date: string
  slot: Slot
  tone: 'light' | 'dark'
}) {
  return (
    <a
      href={slot.href}
      onClick={() =>
        trackEvent(
          tone === 'dark' ? 'book_early_schedule_click' : 'book_schedule_click',
        )
      }
      aria-label={`Book ${slot.label} on ${longDate(date)}`}
      className={`flex min-h-12 items-center justify-center rounded-lg px-3 text-[1.02rem] font-semibold whitespace-nowrap tabular-nums no-underline transition-colors ${
        tone === 'dark'
          ? 'bg-white text-ink hover:bg-action-tint'
          : 'border border-[#c9c1b5] bg-card text-ink hover:border-action hover:bg-action hover:text-white'
      }`}
    >
      {slot.label}
    </a>
  )
}

function DayCard({
  day,
  search,
  filter,
  isSoonest,
}: {
  day: DayGroup
  search: SearchResult
  filter: PageFilter
  isSoonest: boolean
}) {
  const earlier = search.isEarlier(day.date)
  const muted = earlier ? 'text-night-muted' : 'text-ink-muted'
  let heading = 'Open times'
  if (earlier) heading = 'Earlier appointment available'
  else if (isSoonest)
    heading = hasFilter(filter)
      ? 'Soonest that fits you'
      : 'Soonest appointment'
  let waitNote = ''
  if (earlier && search.usualFirstOpening) {
    waitNote = `. Most openings start ${formatDate(search.usualFirstOpening, { month: 'long', day: 'numeric' })}, ${waitPhrase(search.waitDays(search.usualFirstOpening)).replace('in ', '')} away.`
  } else if (earlier) {
    waitNote = '. Times this soon rarely show online.'
  }
  const overall = search.soonest
  return (
    <section
      aria-labelledby="day-card-heading"
      aria-live="polite"
      className={`mt-2 rounded-2xl p-5 sm:p-7 ${
        earlier
          ? 'surface-dark bg-night text-white shadow-[0_1px_2px_rgb(28_37_41/0.12),0_24px_48px_-28px_rgb(28_37_41/0.6)]'
          : 'bg-card shadow-[0_1px_2px_rgb(28_37_41/0.06),0_24px_48px_-28px_rgb(28_37_41/0.35)]'
      }`}
    >
      <h2
        id="day-card-heading"
        className={`m-0 text-base font-semibold ${muted}`}
      >
        {heading}
      </h2>
      <p className="mt-1 mb-0 font-display text-[1.8rem] leading-tight">
        {longDate(day.date)}
      </p>
      <p className={`mt-1 mb-0 text-lg ${muted}`}>
        {waitPhrase(search.waitDays(day.date))}
        {waitNote}
      </p>
      <ul
        role="list"
        className="mt-4 mb-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4"
      >
        {day.slots.map((slot) => (
          <li key={slot.href}>
            <TimeButton
              date={day.date}
              slot={slot}
              tone={earlier ? 'dark' : 'light'}
            />
          </li>
        ))}
      </ul>
      <p className={`mt-4 mb-0 text-[0.95rem] ${muted}`}>
        Mountain Time. Choosing a time opens the U.S. Dermatology Partners
        booking page, where you confirm the visit.
      </p>
      {isSoonest && hasFilter(filter) && overall && overall.date < day.date ? (
        <p className={`mt-2 mb-0 text-[0.95rem] ${muted}`}>
          Sooner at another time:{' '}
          <a
            href={overall.slot.href}
            onClick={() => trackEvent('book_schedule_click')}
            className={
              earlier ? 'font-semibold text-white underline' : 'text-link'
            }
          >
            {shortDate(overall.date)} at {overall.slot.label}
          </a>
        </p>
      ) : null}
    </section>
  )
}

function NoMatch({
  filter,
  soonest,
  today,
  onClearFilter,
}: {
  filter: PageFilter
  soonest: Opening | null
  today: string
  onClearFilter: () => void
}) {
  return (
    <section className="mt-4 rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgb(28_37_41/0.06)] sm:p-7">
      <h2 className="m-0 text-lg font-semibold">
        No open times on {describePageFilter(filter)}.
      </h2>
      {soonest ? (
        <>
          <p className="mt-2 mb-0 text-ink-muted">
            Soonest at any time: {longDate(soonest.date)},{' '}
            {waitPhrase(daysBetween(today, soonest.date))}.
          </p>
          <ul
            role="list"
            className="mt-3 mb-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4"
          >
            <li>
              <TimeButton
                date={soonest.date}
                slot={soonest.slot}
                tone="light"
              />
            </li>
          </ul>
          <p className="mt-3 mb-0 text-[0.95rem] text-ink-muted">
            Mountain Time. Choosing a time opens the U.S. Dermatology Partners
            booking page, where you confirm the visit.
          </p>
        </>
      ) : null}
      <button
        type="button"
        onClick={onClearFilter}
        className="btn-secondary mt-4"
      >
        Show all times
      </button>
    </section>
  )
}

function SwitchNote({
  text,
  action,
  onClick,
}: {
  text: string
  action: string
  onClick: () => void
}) {
  return (
    <aside className="mt-3 flex flex-col gap-2 rounded-xl border border-rule bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 text-[0.98rem] leading-snug">{text}</p>
      <button
        type="button"
        onClick={() => {
          trackEvent('book_switch_note_click')
          onClick()
        }}
        className="shrink-0 self-start rounded-md px-1.5 py-1 font-semibold text-action hover:bg-action-tint sm:self-auto"
      >
        {action} →
      </button>
    </aside>
  )
}

function OtherOptions({ visit }: { visit: Visit }) {
  return (
    <section
      aria-labelledby="other-options-heading"
      className="mt-3 rounded-xl bg-action-tint p-4 sm:p-5"
    >
      <h2 id="other-options-heading" className="m-0 text-base font-semibold">
        {visit === 'office' ? 'Need care sooner?' : 'Want a different time?'}
      </h2>
      <p className="mt-0.5 mb-0 text-[0.98rem] leading-snug text-ink-muted">
        {visit === 'office'
          ? 'Call the office to discuss your concern.'
          : 'Full-body exams with Dr. Hood are usually booked months ahead. New times show here when someone cancels. The office can tell you about other times.'}
      </p>
      <OfficeStatus className="mt-1.5 text-[0.95rem] text-ink-muted" />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={content.office.phoneHref}
          onClick={() => trackEvent('book_call_click')}
          className="btn-secondary whitespace-nowrap"
        >
          <Phone aria-hidden="true" className="h-4.5 w-4.5" />
          Call {content.office.phoneDisplay}
        </a>
        <a
          href={content.booking.callbackHref}
          onClick={() => trackEvent('book_callback_click')}
          className="text-link text-[0.98rem]"
        >
          Request a callback
        </a>
      </div>
    </section>
  )
}

function CallToSchedule({ visit }: { visit: Visit }) {
  return (
    <section
      aria-labelledby="call-heading"
      className="mt-4 rounded-2xl bg-card p-6 shadow-[0_1px_2px_rgb(28_37_41/0.06),0_24px_48px_-28px_rgb(28_37_41/0.35)] sm:p-8"
    >
      <h2
        id="call-heading"
        className="m-0 text-base font-semibold text-ink-muted"
      >
        {visitLabels[visit]} · no online times right now
      </h2>
      <p className="mt-1 mb-0 font-display text-[1.8rem] leading-tight">
        Call to schedule
      </p>
      <p className="mt-2 mb-0 text-[1.02rem] text-ink-muted">
        {visit === 'exam'
          ? 'Full-body exams with Dr. Hood are usually booked months ahead. New times show here when someone cancels.'
          : 'The office can tell you the next opening with Dr. Hood.'}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={content.office.phoneHref}
          onClick={() => trackEvent('book_call_click')}
          className="btn-primary whitespace-nowrap"
        >
          <Phone aria-hidden="true" className="h-4.5 w-4.5" />
          Call {content.office.phoneDisplay}
        </a>
        <a
          href={content.booking.callbackHref}
          onClick={() => trackEvent('book_callback_click')}
          className="btn-secondary whitespace-nowrap"
        >
          Request a callback
          <ArrowUpRight aria-hidden="true" className="h-4.5 w-4.5" />
        </a>
      </div>
      <OfficeStatus className="mt-3 text-[0.95rem] text-ink-muted" />
    </section>
  )
}

function CheckedAt({
  checkedAt,
  refreshing,
  onRefresh,
}: {
  checkedAt: number
  refreshing: boolean
  onRefresh: () => void
}) {
  return (
    <div className="mt-6 text-sm text-ink-muted">
      <p className="m-0 flex flex-wrap items-center gap-x-2">
        Times checked{' '}
        {new Date(checkedAt).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Denver',
        })}{' '}
        MT.
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-1.5 font-semibold text-action hover:bg-action-tint disabled:opacity-60"
        >
          <RotateCw
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
          />
          {refreshing ? 'Checking' : 'Refresh'}
        </button>
      </p>
      <p className="mt-1 mb-0">
        Something look off?{' '}
        <a
          href={content.booking.schedulerHref}
          onClick={() => trackEvent('book_scheduler_click')}
          className="text-link"
        >
          Use the U.S. Dermatology Partners scheduler
        </a>
        .
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="shell max-w-3xl py-8" aria-busy="true">
      <div className="h-24 animate-pulse rounded-xl bg-stone motion-reduce:animate-none" />
      <div className="mt-4 h-16 animate-pulse rounded-xl bg-stone motion-reduce:animate-none" />
      <div className="mt-4 h-64 animate-pulse rounded-2xl bg-stone motion-reduce:animate-none" />
      <p className="sr-only" role="status">
        Loading open times
      </p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mt-6 rounded-2xl bg-card p-6" role="alert">
      <h2 className="m-0 text-xl font-semibold">Open times did not load.</h2>
      <p className="mt-2 mb-0 text-ink-muted">
        Try again, or use the official calendar.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onRetry} className="btn-primary">
          Try again
        </button>
        <a
          href={content.booking.schedulerHref}
          onClick={() => trackEvent('book_scheduler_click')}
          className="btn-secondary"
        >
          Open the official calendar
        </a>
      </div>
    </section>
  )
}
