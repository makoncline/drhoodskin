import { defineHandler } from 'nitro'
import { requestContext, writeActivity } from './src/server/activityLog'
import {
  agentGuideMarkdown,
  llmsTxt,
  agentPaths,
  apiCatalogDocument,
  apiIndexPayload,
  bookingPayload,
  callSiteTool,
  contactPayload,
  contentSignalValue,
  formsPayload,
  getFaqResult,
  getServicesResult,
  insurancePayload,
  homepageMarkdown,
  linkHeaderValues,
  mcpProtocolVersion,
  mcpServerCard,
  officePayload,
  openApiDocument,
  profilePayload,
  searchSiteContent,
  siteCanonical,
  sitemapXml,
  skillArtifacts,
  skillsIndex,
} from './src/lib/agentReady'
import { mcpTools } from './src/lib/mcpTools'
import {
  findAppointments,
  findAppointmentsTool,
  InvalidVisitError,
} from './src/server/appointments'

type JsonRpcRequest = {
  id?: number | string | null
  method: string
  params?: Record<string, unknown>
}

const knownMcpTools = new Set<string>(mcpTools.map((tool) => tool.name))

class RequestBodyTooLargeError extends Error {}

async function readLimitedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get('content-length')) > maxBytes) {
    void request.body?.cancel().catch(() => undefined)
    throw new RequestBodyTooLargeError()
  }
  if (!request.body) return ''

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return text + decoder.decode()
      bytes += value.byteLength
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => undefined)
        throw new RequestBodyTooLargeError()
      }
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

function withBaseHeaders(headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Content-Signal', contentSignalValue)
  responseHeaders.set('X-Robots-Tag', 'index,follow')
  return responseHeaders
}

function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
  contentType = 'application/json; charset=utf-8',
) {
  const headers = withBaseHeaders(init.headers)
  headers.set('Content-Type', contentType)
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  })
}

function markdownResponse(markdown: string, init: ResponseInit = {}) {
  const headers = withBaseHeaders(init.headers)
  headers.set('Content-Type', 'text/markdown; charset=utf-8')
  headers.set('Vary', 'Accept')
  headers.set(
    'X-Markdown-Tokens',
    String(Math.max(1, Math.round(markdown.length / 4))),
  )
  return new Response(markdown, {
    ...init,
    headers,
  })
}

function textResponse(text: string, init: ResponseInit = {}) {
  const headers = withBaseHeaders(init.headers)
  headers.set('Content-Type', 'text/plain; charset=utf-8')
  return new Response(text, {
    ...init,
    headers,
  })
}

function xmlResponse(xml: string, init: ResponseInit = {}) {
  const headers = withBaseHeaders(init.headers)
  headers.set('Content-Type', 'application/xml; charset=utf-8')
  return new Response(xml, {
    ...init,
    headers,
  })
}

function wantsMarkdown(acceptHeader: string | null) {
  return (acceptHeader || '')
    .split(',')
    .some((part) => part.trim().startsWith('text/markdown'))
}

function mcpSuccess(id: JsonRpcRequest['id'], result: unknown) {
  return {
    id: id ?? null,
    jsonrpc: '2.0',
    result,
  }
}

function mcpError(
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
  status = 400,
) {
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
      id: id ?? null,
      jsonrpc: '2.0',
    },
    { status },
  )
}

async function handleMcpRequest(
  request: Request,
  context: ReturnType<typeof requestContext>,
  via: 'webmcp' | undefined,
) {
  let body: unknown

  try {
    body = JSON.parse(await readLimitedBody(request, 64 * 1024))
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return textResponse('Request body too large.', { status: 413 })
    }
    return mcpError(null, -32700, 'Invalid JSON request body', 400)
  }

  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    !('method' in body) ||
    typeof body.method !== 'string'
  ) {
    return mcpError(null, -32600, 'Invalid Request', 400)
  }
  const rpcRequest = body as JsonRpcRequest

  const headers = withBaseHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'MCP-Protocol-Version': mcpProtocolVersion,
  })

  if (rpcRequest.method.startsWith('notifications/')) {
    return new Response(null, { status: 202 })
  }

  if (rpcRequest.method === 'initialize') {
    return new Response(
      JSON.stringify(
        mcpSuccess(rpcRequest.id, {
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          instructions:
            'Use these read-only tools for public information about Dr. Channing Hood and the Golden office. Booking is handled on the official U.S. Dermatology Partners pages linked by the tools.',
          protocolVersion: mcpProtocolVersion,
          serverInfo: {
            name: 'drhoodskin-mcp',
            title: 'Dr Hood Skin Read-Only MCP Server',
            version: '1.0.0',
          },
        }),
        null,
        2,
      ),
      { headers },
    )
  }

  if (rpcRequest.method === 'tools/list') {
    return new Response(
      JSON.stringify(
        mcpSuccess(rpcRequest.id, {
          tools: mcpTools,
        }),
        null,
        2,
      ),
      { headers },
    )
  }

  if (rpcRequest.method === 'tools/call') {
    const toolName =
      typeof rpcRequest.params?.name === 'string'
        ? rpcRequest.params.name
        : null

    if (!toolName) {
      return mcpError(rpcRequest.id, -32602, 'Missing tool name', 400)
    }

    if (!knownMcpTools.has(toolName)) {
      return mcpError(rpcRequest.id, -32601, `Unknown tool: ${toolName}`, 404)
    }

    writeActivity({
      ...context,
      k: 'mcp',
      p: agentPaths.mcpEndpoint,
      tool: toolName,
      via,
    })

    try {
      const toolArguments = rpcRequest.params?.arguments as
        Record<string, unknown> | undefined
      const result =
        toolName === 'find_appointments'
          ? await findAppointmentsTool(toolArguments)
          : callSiteTool(toolName, toolArguments)

      return new Response(
        JSON.stringify(mcpSuccess(rpcRequest.id, result), null, 2),
        {
          headers,
        },
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown MCP tool error'
      return mcpError(rpcRequest.id, -32601, message, 404)
    }
  }

  if (rpcRequest.method === 'ping') {
    return new Response(
      JSON.stringify(mcpSuccess(rpcRequest.id, {}), null, 2),
      {
        headers,
      },
    )
  }

  return mcpError(rpcRequest.id, -32601, 'Method not found', 404)
}

const loggedPaths = new Set<string>([
  '/',
  '/book',
  ...Object.values(agentPaths),
])
const trackedEvents =
  /^(?:(?:hero|closing|header|sticky|visit)_(?:schedule|scheduler|book_page|callback|call)_click|directions_click|press_click|review_outbound_click|forms_click|insurance_source_click|faq_expand|book_(?:early_)?schedule_click|book_scheduler_click|book_call_click|book_callback_click|book_filter_change|book_visit_switch|book_switch_note_click|book_page_view)$/

export default defineHandler(async (event) => {
  const url = new URL(event.req.url, siteCanonical)
  const pathname = url.pathname
  const method = event.method
  const acceptHeader = event.req.headers.get('accept')
  const context = requestContext(event.req.headers, url.hostname)

  if (method === 'GET' && loggedPaths.has(pathname)) {
    writeActivity({
      ...context,
      k: 'request',
      p: pathname,
      md: wantsMarkdown(acceptHeader) || undefined,
    })
  }

  if (pathname === '/api/events') {
    if (method !== 'POST') return textResponse('Use POST.', { status: 405 })
    let name: string
    try {
      name = await readLimitedBody(event.req, 1024)
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return textResponse('Request body too large.', { status: 413 })
      }
      throw error
    }
    const eventName = /^\{"e":"([a-z_]{3,40})"\}$/.exec(name)?.[1]
    if (eventName && trackedEvents.test(eventName) && context.a === 'human') {
      writeActivity({ ...context, k: 'event', p: '/', e: eventName })
    }
    return new Response(null, { status: 204 })
  }

  if (pathname === '/' || pathname === '') {
    for (const linkHeaderValue of linkHeaderValues) {
      event.res.headers.append('Link', linkHeaderValue)
    }
    event.res.headers.set('Content-Signal', contentSignalValue)

    if (wantsMarkdown(acceptHeader)) {
      return markdownResponse(homepageMarkdown)
    }

    return
  }

  if (method === 'GET' && pathname === agentPaths.sitemap) {
    return xmlResponse(sitemapXml)
  }

  if (method === 'GET' && pathname === agentPaths.apiCatalog) {
    return jsonResponse(
      apiCatalogDocument,
      {},
      'application/linkset+json; charset=utf-8',
    )
  }

  if (method === 'GET' && pathname === agentPaths.llmsTxt) {
    return markdownResponse(llmsTxt)
  }

  if (method === 'GET' && pathname === agentPaths.agentGuide) {
    return markdownResponse(agentGuideMarkdown)
  }

  if (method === 'GET' && pathname === agentPaths.skillsIndex) {
    return jsonResponse(skillsIndex)
  }

  if (method === 'GET' && pathname.startsWith('/.well-known/agent-skills/')) {
    const matchingSkill = skillArtifacts.find(
      (skill) =>
        `/.well-known/agent-skills/${skill.slug}/SKILL.md` === pathname,
    )

    if (matchingSkill) {
      return markdownResponse(matchingSkill.text)
    }
  }

  if (method === 'GET' && pathname === agentPaths.mcpServerCard) {
    return jsonResponse(mcpServerCard)
  }

  if (method === 'GET' && pathname === agentPaths.openApi) {
    return jsonResponse(
      openApiDocument,
      {},
      'application/openapi+json; charset=utf-8',
    )
  }

  if (method === 'GET' && pathname === agentPaths.apiIndex) {
    return jsonResponse(apiIndexPayload)
  }

  if (method === 'GET' && pathname === agentPaths.status) {
    return jsonResponse({
      lastReviewed: profilePayload.reviewedAt,
      site: siteCanonical,
      status: 'ok',
      surfaces: {
        apiCatalog: agentPaths.apiCatalog,
        mcp: agentPaths.mcpEndpoint,
        skills: agentPaths.skillsIndex,
      },
    })
  }

  if (method === 'GET' && pathname === agentPaths.profile) {
    return jsonResponse(profilePayload)
  }

  if (method === 'GET' && pathname === agentPaths.office) {
    return jsonResponse(officePayload)
  }

  if (method === 'GET' && pathname === agentPaths.contact) {
    return jsonResponse(contactPayload)
  }

  if (method === 'GET' && pathname === agentPaths.forms) {
    return jsonResponse(formsPayload)
  }

  if (method === 'GET' && pathname === agentPaths.insurance) {
    return jsonResponse(insurancePayload)
  }

  if (method === 'GET' && pathname === agentPaths.services) {
    return jsonResponse(
      getServicesResult(url.searchParams.get('category') || undefined),
    )
  }

  if (method === 'GET' && pathname === agentPaths.faq) {
    return jsonResponse(
      getFaqResult(url.searchParams.get('question') || undefined),
    )
  }

  if (method === 'GET' && pathname === agentPaths.booking) {
    return jsonResponse(bookingPayload)
  }

  if (method === 'GET' && pathname === agentPaths.appointments) {
    try {
      return jsonResponse(
        await findAppointments({
          visit: url.searchParams.get('visit') ?? undefined,
          days: url.searchParams.getAll('days'),
          times: url.searchParams.getAll('times'),
          avoid: url.searchParams.getAll('avoid'),
          limit: url.searchParams.get('limit') ?? undefined,
        }),
      )
    } catch (error) {
      if (error instanceof InvalidVisitError) {
        return jsonResponse({ error: error.message }, { status: 400 })
      }
      return jsonResponse(
        {
          error: 'Open times could not be loaded.',
          officialCalendar: bookingPayload.booking.schedulerHref,
          phone: contactPayload.phoneDisplay,
        },
        { status: 502 },
      )
    }
  }

  if (method === 'GET' && pathname === agentPaths.search) {
    const limitParam = Number(url.searchParams.get('limit') || '8')
    const limit = Number.isFinite(limitParam) ? limitParam : 8
    return jsonResponse(
      searchSiteContent(url.searchParams.get('q') || undefined, limit),
    )
  }

  if (pathname === agentPaths.mcpEndpoint) {
    if (method === 'POST') {
      return handleMcpRequest(
        event.req,
        context,
        url.searchParams.get('via') === 'webmcp' ? 'webmcp' : undefined,
      )
    }

    return textResponse(
      'Use POST JSON-RPC requests against this endpoint after reading the MCP server card.',
      { status: 405 },
    )
  }
})
