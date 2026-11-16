const fixtureUrl = new URL(process.env.NEXT_PATIENT_FIXTURE_URL)
if (
  fixtureUrl.protocol !== 'http:' ||
  fixtureUrl.hostname !== '127.0.0.1' ||
  fixtureUrl.pathname !== '/fetch'
)
  throw new Error('A local NextPatient fixture service is required')

process.on('disconnect', () => process.kill(process.pid, 'SIGTERM'))
process.channel?.unref()

const transport = globalThis.fetch

globalThis.fetch = async (input, init) => {
  const request = new Request(input, init)
  return transport(fixtureUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: request.url, method: request.method }),
    redirect: 'manual',
    signal: request.signal,
  })
}
