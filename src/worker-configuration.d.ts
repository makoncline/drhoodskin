import type { InferEnv } from '@alchemy.run/cloudflare'
import type { Website } from '../alchemy.run'
type AppEnvironment = InferEnv<typeof Website>
declare global {
  namespace Cloudflare {
    interface Env extends AppEnvironment {}
  }
}
