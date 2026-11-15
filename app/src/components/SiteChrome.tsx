import { Phone } from 'lucide-react'
import { drHoodVerified } from '../content/drHoodVerified'
import { trackEvent } from '../lib/analytics'

const content = drHoodVerified

export function SiteHeader({ showBooking = true }: { showBooking?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur-md">
      <div className="shell flex min-h-16 items-center justify-between gap-4 py-2.5">
        <a href="/#top" className="flex flex-col leading-tight no-underline">
          <span className="font-display text-lg">Dr. Channing Hood</span>
          <span className="text-sm text-ink-muted">Dermatology · Golden, Colorado</span>
        </a>
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-3">
          <a
            href="/#visit"
            className="hidden rounded-lg px-3 py-2 text-[0.95rem] font-semibold no-underline hover:bg-stone lg:inline-flex"
          >
            Location &amp; hours
          </a>
          <a
            href={content.office.phoneHref}
            onClick={() => trackEvent('header_call_click')}
            aria-label={`Call the Golden office, ${content.office.phoneDisplay}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-[0.95rem] font-semibold no-underline transition-colors hover:bg-stone"
          >
            <Phone aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">{content.office.phoneDisplay}</span>
          </a>
          {showBooking ? (
            <a
              href={content.booking.href}
              onClick={() => trackEvent('header_schedule_click')}
              className="btn-primary hidden min-h-11 px-4 py-2 text-[0.95rem] md:inline-flex"
            >
              Book an appointment
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  )
}


export function SiteFooter({ clearMobileBar = false }: { clearMobileBar?: boolean }) {
  return (
    <footer className={`surface-dark bg-night text-night-muted ${clearMobileBar ? 'pb-24 md:pb-0' : ''}`}>
      <div className="shell grid gap-8 py-12 text-[0.95rem] md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="m-0 font-display text-lg text-white">{content.identity.name}</p>
          <p className="m-0">
            {content.identity.title}, {content.office.name}
          </p>
          <p className="m-0">
            {content.office.address1}, {content.office.city}, {content.office.state}{' '}
            {content.office.zip} · {content.office.phoneDisplay}
          </p>
          <p className="mt-4 mb-0">
            This is Dr. Hood’s personal site. U.S. Dermatology Partners schedules all
            appointments. Information last reviewed {content.meta.lastReviewed}.
          </p>
        </div>
        <ul role="list" className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
          <li>
            <a href={content.officialSources.provider} className="font-semibold text-white underline decoration-white/40 hover:decoration-white">
              USDP provider profile
            </a>
          </li>
          <li>
            <a href={content.officialSources.goldenOffice} className="font-semibold text-white underline decoration-white/40 hover:decoration-white">
              Golden office page
            </a>
          </li>
          <li>
            <a href={content.booking.href} className="font-semibold text-white underline decoration-white/40 hover:decoration-white">
              Dr. Hood’s open times
            </a>
          </li>
          <li>
            <a href={content.booking.callbackHref} className="font-semibold text-white underline decoration-white/40 hover:decoration-white">
              Callback request form
            </a>
          </li>
        </ul>
      </div>
    </footer>
  )
}
