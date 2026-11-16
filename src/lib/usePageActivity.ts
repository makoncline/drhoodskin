import { useEffect, useRef } from 'react'
import { useLocation } from '@tanstack/react-router'
import { trackEvent } from './analytics'

export function usePageActivity() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current !== pathname && pathname === '/book') trackEvent('book_page_view')
    previous.current = pathname
  }, [pathname])
}
