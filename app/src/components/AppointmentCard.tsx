import { Link } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight, Phone } from 'lucide-react'
import { drHoodVerified } from '../content/drHoodVerified'
import { trackEvent } from '../lib/analytics'
import { OfficeStatus } from './OfficeStatus'

const { booking, office } = drHoodVerified

export function AppointmentCard({
  id,
  headingId,
  placement,
}: {
  id?: string
  headingId: string
  placement: 'hero' | 'closing'
}) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="surface-light rounded-2xl bg-card p-4 text-ink shadow-[0_1px_2px_rgb(28_37_41/0.06),0_24px_48px_-28px_rgb(28_37_41/0.35)] sm:p-7"
    >
      <h2
        id={headingId}
        className="m-0 font-display text-[1.45rem] leading-tight font-normal sm:text-[1.6rem]"
      >
        {booking.heading}
      </h2>

      <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5">
        <Link
          to="/book"
          onClick={() => trackEvent(`${placement}_schedule_click`)}
          data-booking-control
          className="btn-primary w-full px-6 sm:w-auto"
        >
          {booking.ctaLabel}
          <ArrowRight aria-hidden="true" className="h-4.5 w-4.5" />
        </Link>
        <p className="m-0 text-[0.98rem] leading-snug text-ink-muted sm:text-[1.02rem]">
          <strong className="text-ink">{booking.scheduleOutcome}</strong>{' '}
          {booking.scheduleDetail}{' '}
          <a
            href={booking.schedulerHref}
            onClick={() => trackEvent(`${placement}_scheduler_click`)}
            className="text-link"
          >
            {booking.schedulerLabel}
          </a>
        </p>
      </div>

      <div className="mt-4 grid gap-4 border-t border-rule pt-4 sm:mt-6 sm:grid-cols-2 sm:gap-6 sm:pt-5">
        <div className="flex flex-col gap-2">
          <a
            href={booking.callbackHref}
            onClick={() => trackEvent(`${placement}_callback_click`)}
            className="btn-secondary w-full"
          >
            {booking.callbackLabel}
            <ArrowUpRight aria-hidden="true" className="h-4.5 w-4.5" />
          </a>
          <p className="m-0 text-[0.98rem] leading-snug text-ink-muted">
            <strong className="text-ink">{booking.callbackOutcome}</strong>{' '}
            {booking.callbackDetail}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href={office.phoneHref}
            onClick={() => trackEvent(`${placement}_call_click`)}
            className="btn-secondary w-full"
          >
            <Phone aria-hidden="true" className="h-4.5 w-4.5" />
            Call {office.phoneDisplay}
          </a>
          <OfficeStatus className="text-[0.98rem] leading-snug text-ink-muted" />
        </div>
      </div>
    </section>
  )
}
