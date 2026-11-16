declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    ASSETS: Fetcher
    CF_VERSION_METADATA?: WorkerVersionMetadata
  }
}
