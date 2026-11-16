import { defineHandler } from 'nitro'
import { handlePublicRequest } from './src/server/http'
import { contentSignalValue, linkHeaderValues } from './src/lib/agentReady'

export default defineHandler(async (event) => {
  const correlationId = crypto.randomUUID()
  const pathname = new URL(event.req.url).pathname
  const headers = new Headers({
    'X-Correlation-ID': correlationId,
    'X-Release': process.env.APP_REVISION ?? 'local',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  })
  if (pathname === '/') {
    for (const value of linkHeaderValues) headers.append('Link', value)
    headers.set('Content-Signal', contentSignalValue)
    headers.set('Vary', 'Accept')
  }
  const response = await handlePublicRequest(event.req, {
    waitUntil(task) {
      void task.catch(() => console.error('Background activity failed'))
    },
  })
  if (!response) {
    for (const [name, value] of headers) event.res.headers.set(name, value)
    return
  }
  // h3 discards event.res headers when a handler returns an error-status Response.
  const result = new Response(response.body, response)
  for (const [name, value] of headers) result.headers.set(name, value)
  return result
})
