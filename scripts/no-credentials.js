export function refuseCredentials() {
  for (const key of [
    'OP_TOKEN',
    'OP_SERVICE_ACCOUNT_TOKEN',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_API_KEY',
  ]) {
    if (process.env[key])
      throw new Error(`Unset ${key}. Local work refuses production credentials.`)
  }
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24.')
}
