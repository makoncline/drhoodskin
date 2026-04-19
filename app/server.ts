import { defineHandler } from 'nitro'
import {
  agentGuideMarkdown,
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
  mcpTools,
  officePayload,
  openApiDocument,
  profilePayload,
  searchSiteContent,
  siteCanonical,
  sitemapXml,
  skillArtifacts,
  skillsIndex,
} from './src/lib/agentReady'

type JsonRpcRequest = {
  id?: number | string | null
  method?: string
  params?: Record<string, unknown>
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
  headers.set('X-Markdown-Tokens', String(Math.max(1, Math.round(markdown.length / 4))))
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

async function handleMcpRequest(request: Request) {
  let rpcRequest: JsonRpcRequest

  try {
    rpcRequest = (await request.json()) as JsonRpcRequest
  } catch {
    return mcpError(null, -32700, 'Invalid JSON request body', 400)
  }

  const headers = withBaseHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'MCP-Protocol-Version': mcpProtocolVersion,
  })

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
      typeof rpcRequest.params?.name === 'string' ? rpcRequest.params.name : null

    if (!toolName) {
      return mcpError(rpcRequest.id, -32602, 'Missing tool name', 400)
    }

    try {
      const result = callSiteTool(
        toolName,
        rpcRequest.params?.arguments as Record<string, unknown> | undefined,
      )

      return new Response(JSON.stringify(mcpSuccess(rpcRequest.id, result), null, 2), {
        headers,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown MCP tool error'
      return mcpError(rpcRequest.id, -32601, message, 404)
    }
  }

  if (rpcRequest.method === 'ping') {
    return new Response(JSON.stringify(mcpSuccess(rpcRequest.id, {}), null, 2), {
      headers,
    })
  }

  return mcpError(rpcRequest.id, -32601, 'Method not found', 404)
}

export default defineHandler(async (event) => {
  const url = new URL(event.req.url, siteCanonical)
  const pathname = url.pathname
  const method = event.method
  const acceptHeader = event.req.headers.get('accept')

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
    return jsonResponse(apiCatalogDocument, {}, 'application/linkset+json; charset=utf-8')
  }

  if (method === 'GET' && pathname === agentPaths.agentGuide) {
    return markdownResponse(agentGuideMarkdown)
  }

  if (method === 'GET' && pathname === agentPaths.skillsIndex) {
    return jsonResponse(skillsIndex)
  }

  if (method === 'GET' && pathname.startsWith('/.well-known/agent-skills/')) {
    const matchingSkill = skillArtifacts.find(
      (skill) => `/.well-known/agent-skills/${skill.slug}/SKILL.md` === pathname,
    )

    if (matchingSkill) {
      return markdownResponse(matchingSkill.text)
    }
  }

  if (method === 'GET' && pathname === agentPaths.mcpServerCard) {
    return jsonResponse(mcpServerCard)
  }

  if (method === 'GET' && pathname === agentPaths.openApi) {
    return jsonResponse(openApiDocument, {}, 'application/openapi+json; charset=utf-8')
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
    return jsonResponse(getFaqResult(url.searchParams.get('question') || undefined))
  }

  if (method === 'GET' && pathname === agentPaths.booking) {
    return jsonResponse(bookingPayload)
  }

  if (method === 'GET' && pathname === agentPaths.search) {
    const limitParam = Number(url.searchParams.get('limit') || '8')
    const limit = Number.isFinite(limitParam) ? limitParam : 8
    return jsonResponse(searchSiteContent(url.searchParams.get('q') || undefined, limit))
  }

  if (pathname === agentPaths.mcpEndpoint) {
    if (method === 'POST') {
      return handleMcpRequest(event.req)
    }

    return textResponse(
      'Use POST JSON-RPC requests against this endpoint after reading the MCP server card.',
      { status: 405 },
    )
  }
})
