import { createHash, randomBytes } from 'node:crypto'
import { drizzle } from 'drizzle-orm/d1'
import { activity } from '../../db/schema'
import { activityDay, classifyAgent } from '../lib/activity'
import type { ActivityEntry } from '../lib/activity'

type ActivityDetails = Pick<ActivityEntry, 'k' | 'p' | 'md' | 'e' | 'tool' | 'via'>

export async function logActivity(db: D1Database, request: Request, details: ActivityDetails) {
  try {
    const headers = request.headers
    const userAgent = headers.get('user-agent') ?? ''
    const agent = classifyAgent(userAgent)
    const now = new Date()
    let visitor: string | undefined
    if (agent.a === 'human') {
      const day = activityDay(now)
      const [, result] = await db.batch([
        db
          .prepare('INSERT INTO visitor_salts (day, salt) VALUES (?, ?) ON CONFLICT DO NOTHING')
          .bind(day, randomBytes(16).toString('hex')),
        db.prepare('SELECT salt FROM visitor_salts WHERE day = ?').bind(day),
      ])
      const salt = (result.results[0] as { salt: string }).salt
      const ip =
        headers.get('cf-connecting-ip') ??
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        ''
      visitor = createHash('sha256').update(`${salt}|${ip}|${userAgent}`).digest('hex').slice(0, 12)
    }
    let referrerHost: string | undefined
    const referrer = headers.get('referer')
    if (referrer && URL.canParse(referrer)) {
      const host = new URL(referrer).hostname
      if (host !== new URL(request.url).hostname) referrerHost = host
    }
    const entry: ActivityEntry = {
      t: now.toISOString(),
      ...agent,
      v: visitor,
      c: headers.get('cf-ipcountry') ?? undefined,
      r: referrerHost,
      ...details,
    }
    await drizzle(db).insert(activity).values(entry)
    console.log(JSON.stringify(entry))
  } catch {
    console.error('Activity log write failed')
  }
}

export async function retainActivity(db: D1Database, now: number) {
  const today = new Date(now).toISOString().slice(0, 10)
  const claim = await db
    .prepare(
      "INSERT INTO maintenance (name, day) VALUES ('activity', ?) ON CONFLICT(name) DO UPDATE SET day = excluded.day WHERE maintenance.day < excluded.day RETURNING day",
    )
    .bind(today)
    .first()
  if (!claim) return
  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 180)
  try {
    await db.batch([
      db.prepare('DELETE FROM activity WHERE t < ?').bind(cutoff.toISOString()),
      db.prepare('DELETE FROM visitor_salts WHERE day < ?').bind(activityDay(new Date(now))),
    ])
  } catch (error) {
    await db
      .prepare("DELETE FROM maintenance WHERE name = 'activity' AND day = ?")
      .bind(today)
      .run()
    throw error
  }
}
