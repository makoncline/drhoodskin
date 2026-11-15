import { createServerFn } from '@tanstack/react-start'
import { cachedAvailability } from './availabilityCache'

async function settled(promise: ReturnType<typeof cachedAvailability>) {
  try {
    return await promise
  } catch {
    return null
  }
}

export const getSchedulerData = createServerFn({ method: 'GET' })
  .inputValidator((input: { fresh?: boolean } | undefined) => ({
    fresh: input?.fresh === true,
  }))
  .handler(async ({ data }) => {
    const [office, exam] = await Promise.all([
      settled(cachedAvailability('office', data)),
      settled(cachedAvailability('full-body-exam', data)),
    ])
    return { office, exam }
  })
