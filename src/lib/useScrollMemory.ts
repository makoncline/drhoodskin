import { useRouter } from '@tanstack/react-router'
import {
  defaultGetScrollRestorationKey,
  storageKey,
} from '@tanstack/router-core'
import { useEffect } from 'react'

const saveDelayMs = 150

export function useScrollMemory() {
  const router = useRouter()

  useEffect(() => {
    let timer: number | undefined
    const onScroll = () => {
      const key = defaultGetScrollRestorationKey(
        router.state.resolvedLocation ?? router.state.location,
      )
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        try {
          const saved = JSON.parse(
            sessionStorage.getItem(storageKey) ?? '{}',
          ) as Record<string, Record<string, unknown>>
          saved[key] = {
            ...saved[key],
            window: { scrollX: window.scrollX, scrollY: window.scrollY },
          }
          sessionStorage.setItem(storageKey, JSON.stringify(saved))
        } catch {
          return
        }
      }, saveDelayMs)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [router])
}
