import { createServerFn } from '@tanstack/react-start'
import { cachedAvailability } from './availabilityCache'

export const getSchedulerData = createServerFn({ method: 'GET' })
  .validator((input: { fresh?: boolean } | undefined) => ({ fresh: input?.fresh === true }))
  .handler(async ({ data }) => {
    const [office, exam] = await Promise.all([
      cachedAvailability('office', data).catch(() => null),
      cachedAvailability('full-body-exam', data).catch(() => null),
    ])
    return { office, exam }
  })
