import { applyMigrations, MigrationError } from '@alchemy.run/sql/Migrations'
import { NodeServices } from '@effect/platform-node'
import { Effect } from 'effect'

// Use the production migration reader and bookkeeping with real local D1.
export function migrateLocalDatabase(db) {
  const attempt = (run) =>
    Effect.tryPromise({
      try: run,
      catch: (cause) => new MigrationError({ message: 'Local D1 migration failed', cause }),
    })
  return Effect.runPromise(
    applyMigrations({
      resolved: { dir: 'db/migrations', table: '__alchemy_migrations' },
      executor: {
        dialect: 'sqlite',
        query: (sql, params = []) =>
          attempt(async () => {
            const statement = db.prepare(sql)
            const result = await (params.length ? statement.bind(...params) : statement).all()
            return result.results
          }),
        batch: (statements) =>
          attempt(async () => {
            await db.batch(statements.map((sql) => db.prepare(sql)))
          }),
      },
    }).pipe(Effect.provide(NodeServices.layer)),
  )
}
