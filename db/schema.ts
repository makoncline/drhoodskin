import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Availability } from '../src/lib/nextPatientSchedule'
import type { ActivityEntry, AgentClass } from '../src/lib/activity'

export const availability = sqliteTable('availability', {
  visit: text().primaryKey().$type<'office' | 'full-body-exam'>(),
  snapshot: text({ mode: 'json' }).$type<Availability>(),
  checkedAt: integer('checked_at'),
  dueAt: integer('due_at').notNull().default(0),
  retryMs: integer('retry_ms').notNull().default(0),
  error: text(),
})

export const activity = sqliteTable(
  'activity',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    t: text().notNull(),
    k: text().notNull().$type<ActivityEntry['k']>(),
    p: text().notNull(),
    a: text().notNull().$type<AgentClass>(),
    an: text(),
    v: text(),
    c: text(),
    r: text(),
    md: integer({ mode: 'boolean' }),
    e: text(),
    tool: text(),
    via: text().$type<'webmcp'>(),
  },
  (table) => [index('activity_time').on(table.t)],
)

export const visitorSalts = sqliteTable('visitor_salts', {
  day: text().primaryKey(),
  salt: text().notNull(),
})

export const maintenance = sqliteTable('maintenance', {
  name: text().primaryKey(),
  day: text().notNull(),
})
