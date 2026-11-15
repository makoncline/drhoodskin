import { createServerFn } from '@tanstack/react-start'
import { cachedAvailability } from './availabilityCache'

export const getSchedulerData = createServerFn({ method: 'GET' }).handler(async () => {
  const [office, exam] = await Promise.all([
    cachedAvailability('office').catch(() => null),
    cachedAvailability('full-body-exam').catch(() => null),
  ])
  return { office, exam }
})
