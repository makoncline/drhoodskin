declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
    gtag?: (...args: unknown[]) => void
  }
}

type EventProps = Record<string, string | number | boolean | undefined>

export function trackEvent(event: string, props: EventProps = {}) {
  if (typeof window === 'undefined') {
    return
  }

  const payload = { event, ...props }

  const body = JSON.stringify({ e: event })
  if (!navigator.sendBeacon('/api/events', body)) {
    void fetch('/api/events', { method: 'POST', body, keepalive: true }).catch(() => undefined)
  }

  window.dataLayer?.push(payload)
  window.dispatchEvent(new CustomEvent('analytics-event', { detail: payload }))

  if (typeof window.gtag === 'function') {
    window.gtag('event', event, props)
  }
}
