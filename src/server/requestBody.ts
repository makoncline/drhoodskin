export const eventBodyLimit = 1024
export const mcpBodyLimit = 64 * 1024

export class RequestBodyTooLargeError extends Error {}

export async function readLimitedBody(request: Request, maxBytes: number) {
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
