declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    CF_VERSION_METADATA?: WorkerVersionMetadata
  }
}
