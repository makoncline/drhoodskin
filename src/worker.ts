import handler from '@tanstack/react-start/server-entry'
import { handlePublicRequest } from './server/http'
import { refreshDueAvailability } from './server/availabilityCache'
import { retainActivity } from './server/activityLog'
import { agentPaths, contentSignalValue, linkHeaderValues } from './lib/agentReady'

const publicPaths = new Set<string>(['/', '/book', '/robots.txt', ...Object.values(agentPaths)])

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const correlationId = crypto.randomUUID()
    const started = performance.now()
    const pathname = new URL(request.url).pathname
    let status = 500
    try {
      const result = await handlePublicRequest(request, env.DB, ctx) ?? await handler.fetch(request)
      const response = new Response(result.body, result)
      if (pathname === '/') {
        for (const value of linkHeaderValues) response.headers.append('Link', value)
        response.headers.set('Content-Signal', contentSignalValue)
        response.headers.set('Vary', 'Accept')
      }
      response.headers.set('X-Correlation-ID', correlationId)
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('Cache-Control', 'no-store')
      status = response.status
      return response
    } catch {
      return new Response(`Something went wrong. Reference: ${correlationId}`, {
        status: 500,
        headers: { 'X-Correlation-ID': correlationId, 'Content-Type': 'text/plain; charset=utf-8' },
      })
    } finally {
      const record = JSON.stringify({
        msg: 'request.completed', service: 'drhoodskin', release: env.CF_VERSION_METADATA?.id ?? 'local',
        correlation_id: correlationId, method: request.method,
        route: publicPaths.has(pathname) ? pathname : pathname.startsWith('/_serverFn/') ? '/_serverFn/:function' : '/:unmatched',
        status, duration_ms: Math.round(performance.now() - started),
      })
      if (status >= 500) console.error(record)
      else console.info(record)
    }
  },
  async scheduled(controller: ScheduledController, env: Cloudflare.Env) {
    await retainActivity(env.DB, controller.scheduledTime).catch(() => console.error('Activity retention failed'))
    await refreshDueAvailability(env.DB, controller.scheduledTime)
  },
}
