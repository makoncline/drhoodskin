import { createHash, randomBytes } from 'node:crypto'
import {
  appendFileSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { activityDay, classifyAgent } from '../lib/activity.ts'
import type { ActivityEntry } from '../lib/activity.ts'

export { activityDay, classifyAgent } from '../lib/activity.ts'
export type { ActivityEntry } from '../lib/activity.ts'

type ActivityDetails = Pick<ActivityEntry, 'k' | 'p' | 'md' | 'e' | 'tool' | 'via'>
let salt = { day: '', directory: '', value: '', persisted: false }
const cleanupDays = new Map<string, string>()

function readSalt(path: string) {
  const stored = readFileSync(path, 'utf8').trim()
  if (!/^[a-f0-9]{32}$/.test(stored)) throw new Error('Invalid visitor salt file')
  return stored
}

function publishSalt(directory: string, day: string, value: string) {
  const path = join(directory, `visitor-salt-${day}`)
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`
  writeFileSync(temporary, value, { flag: 'wx', mode: 0o600 })
  try {
    linkSync(temporary, path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  } finally {
    unlinkSync(temporary)
  }
  return readSalt(path)
}

function dailySalt(day: string, directory: string) {
  const sameDay = salt.day === day && salt.directory === directory
  if (sameDay && salt.persisted) return salt.value
  let value = sameDay ? salt.value : randomBytes(16).toString('hex')
  let persisted = !directory
  if (directory) {
    try {
      mkdirSync(directory, { recursive: true })
      value = publishSalt(directory, day, value)
      persisted = true
    } catch {
      console.error('Visitor identity persistence unavailable; using a process-local salt')
    }
  }
  salt = { day, directory, value, persisted }
  return value
}

export function requestContext(headers: Headers, siteHost: string) {
  const userAgent = headers.get('user-agent') ?? ''
  const agent = classifyAgent(userAgent)
  const now = new Date()
  const ip =
    headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const directory = process.env.LOG_DIR ?? ''
  const visitor =
    agent.a === 'human'
      ? createHash('sha256')
          .update(`${dailySalt(activityDay(now), directory)}|${ip}|${userAgent}`)
          .digest('hex')
          .slice(0, 12)
      : undefined
  const referrer = headers.get('referer')
  const referrerHost = referrer && URL.canParse(referrer) ? new URL(referrer).hostname : undefined
  return {
    t: now.toISOString(),
    ...agent,
    v: visitor,
    c: headers.get('cf-ipcountry') ?? undefined,
    r: referrerHost !== siteHost ? referrerHost : undefined,
  }
}

export function retainActivity(directory = process.env.LOG_DIR, now = new Date()) {
  if (!directory) return
  const today = now.toISOString().slice(0, 10)
  if (cleanupDays.get(directory) === today) return
  const cutoff = new Date(`${today}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - 180)
  const oldest = cutoff.toISOString().slice(0, 10)
  const currentSaltDay = activityDay(now)
  for (const file of readdirSync(directory, { withFileTypes: true })) {
    if (!file.isFile()) continue
    const activityDate = /^activity-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(file.name)?.[1]
    const saltDate = /^visitor-salt-(\d{4}-\d{2}-\d{2})$/.exec(file.name)?.[1]
    const day = activityDate ?? saltDate
    if (!day) continue
    const date = new Date(`${day}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) continue
    if (activityDate ? day < oldest : day < currentSaltDay) unlinkSync(join(directory, file.name))
  }
  cleanupDays.set(directory, today)
}

export function writeActivity(entry: ActivityEntry, directory = process.env.LOG_DIR) {
  const line = JSON.stringify(entry)
  console.log(line)
  if (!directory) return
  try {
    mkdirSync(directory, { recursive: true })
    appendFileSync(join(directory, `activity-${entry.t.slice(0, 10)}.jsonl`), `${line}\n`, {
      mode: 0o600,
    })
  } catch {
    console.error('Activity log write failed')
    return
  }
  try {
    retainActivity(directory)
  } catch {
    console.error('Activity log cleanup failed')
  }
}

export async function logActivity(request: Request, details: ActivityDetails) {
  try {
    writeActivity({ ...requestContext(request.headers, new URL(request.url).hostname), ...details })
  } catch {
    console.error('Activity log write failed')
  }
}
