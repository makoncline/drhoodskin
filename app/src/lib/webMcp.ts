import { mcpTools } from './mcpTools'

type ToolInput = Record<string, unknown> | undefined

export type PageTool = {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
  execute: (input: ToolInput) => Promise<unknown>
}

type WebMcpTool = Omit<PageTool, 'execute'> & {
  execute: (
    input: ToolInput,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>
}

type ModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void> | undefined
  unregisterTool?: (name: string) => void
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }
  interface Navigator {
    modelContext?: ModelContext
  }
}

export const webMcpEndpoint = '/mcp?via=webmcp'

async function callTool(name: string, input: ToolInput, signal?: AbortSignal) {
  const response = await fetch(webMcpEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: input ?? {} },
    }),
    signal,
  })
  const body = (await response.json()) as {
    result?: unknown
    error?: { message: string }
  }
  if (body.error) throw new Error(body.error.message)
  return body.result
}

async function register(
  modelContext: ModelContext,
  tool: WebMcpTool,
  signal: AbortSignal,
) {
  try {
    await modelContext.registerTool(tool, { signal })
  } catch (error) {
    console.debug(`WebMCP could not register ${tool.name}`, error)
  }
}

export function registerWebMcpTools(pageTools: PageTool[] = []) {
  const modelContext = document.modelContext ?? navigator.modelContext
  if (!modelContext) return () => undefined

  const tools: WebMcpTool[] = [
    ...mcpTools.map((tool) => ({
      ...tool,
      execute: (input: ToolInput, options?: { signal?: AbortSignal }) =>
        callTool(tool.name, input, options?.signal),
    })),
    ...pageTools,
  ]
  const controller = new AbortController()
  for (const tool of tools) void register(modelContext, tool, controller.signal)

  return () => {
    controller.abort()
    for (const tool of tools) modelContext.unregisterTool?.(tool.name)
  }
}
