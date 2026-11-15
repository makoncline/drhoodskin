import { describe, expect, it } from 'vite-plus/test'
import {
  eventBodyLimit,
  mcpBodyLimit,
  readLimitedBody,
  RequestBodyTooLargeError,
} from './requestBody'

describe.each([eventBodyLimit, mcpBodyLimit])('body limit of %i bytes', (limit) => {
  it('rejects an oversized declared length before reading', async () => {
    const request = new Request('https://drhoodskin.com', {
      method: 'POST',
      headers: { 'content-length': String(limit + 1) },
      body: '{}',
    })
    await expect(readLimitedBody(request, limit)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
    expect(request.bodyUsed).toBe(true)
  })

  it.each([undefined, '1'])(
    'stops and cancels an oversized UTF-8 stream with declared length %s',
    async (length) => {
      let cancelled = false,
        chunks = 0
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          chunks += 1
          controller.enqueue(new TextEncoder().encode('é'.repeat(256)))
        },
        cancel() {
          cancelled = true
        },
      })
      const request = new Request('https://drhoodskin.com', {
        method: 'POST',
        ...(length ? { headers: { 'content-length': length } } : {}),
        body,
        duplex: 'half',
      } as RequestInit)
      await expect(readLimitedBody(request, limit)).rejects.toBeInstanceOf(RequestBodyTooLargeError)
      expect(cancelled).toBe(true)
      expect(chunks).toBeLessThanOrEqual(limit / 512 + 2)
    },
  )

  it('accepts the exact byte boundary', async () => {
    const body = 'é'.repeat(limit / 2)
    expect(
      await readLimitedBody(new Request('https://drhoodskin.com', { method: 'POST', body }), limit),
    ).toBe(body)
  })
})
