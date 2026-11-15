import { mkdirSync, writeFileSync } from 'node:fs'
import app from '../config/app.json' with { type: 'json' }
const id = app.production.onePasswordEnvironmentId
if (!/^[a-z0-9]{20,40}$/.test(id))
  throw new Error('Set production.onePasswordEnvironmentId in config/app.json first.')
mkdirSync('ops', { recursive: true })
writeFileSync(
  'ops/.env.schema',
  `# @plugin(@varlock/1password-plugin)\n# @initOp(token=$OP_TOKEN, allowAppAuth=false)\n# @setValuesBulk(opLoadEnvironment(${id}))\n# @defaultRequired=true\n# @defaultSensitive=true\n# ---\n# @type=opServiceAccountToken @internal\nOP_TOKEN=\nCLOUDFLARE_API_TOKEN=\n`,
)
console.log('Generated secret contract; no secret values written.')
