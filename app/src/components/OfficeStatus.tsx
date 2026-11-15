import { useEffect, useState } from 'react'
import { officeStatus, openHoursSummary } from '../lib/officeHours'
import type { OfficeStatus as Status } from '../lib/officeHours'

export function OfficeStatus({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    const update = () => setStatus(officeStatus())
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <p className={`m-0 flex items-center gap-2 ${className}`.trim()}>
      <span
        aria-hidden="true"
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
          status === null
            ? 'bg-current opacity-40'
            : status.open
              ? 'bg-action'
              : 'bg-current opacity-60'
        }`}
      />
      {status === null ? (
        <span>Office hours: {openHoursSummary()}</span>
      ) : status.open ? (
        <span>
          <strong>Office open now</strong> until {status.closesLabel} Mountain Time
        </span>
      ) : (
        <span>
          <strong>Office closed now.</strong> Opens {status.nextOpenLabel}
        </span>
      )}
    </p>
  )
}
