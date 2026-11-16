import { mkdtempSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { retainActivity } from './activityLog'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})
function directory() {
  const value = mkdtempSync(join(tmpdir(), 'drhoodskin-retention-'))
  directories.push(value)
  return value
}

describe('scoped JSONL retention', () => {
  it('keeps the boundary day and protects unrelated, invalid, directory, and symlink targets', () => {
    const root = directory()
    const now = new Date('2026-11-16T06:30:00Z')
    const cutoff = new Date('2026-11-16T00:00:00Z')
    cutoff.setUTCDate(cutoff.getUTCDate() - 180)
    const boundary = `activity-${cutoff.toISOString().slice(0, 10)}.jsonl`
    for (const name of [
      'activity-2000-01-01.jsonl',
      boundary,
      'activity-2026-11-16.jsonl',
      'activity-2000-02-30.jsonl',
      'notes.txt',
      'target.txt',
      'visitor-salt-2026-11-14',
      'visitor-salt-2026-11-15',
      'visitor-salt-2000-02-30',
    ])
      writeFileSync(join(root, name), 'synthetic fixture')
    mkdirSync(join(root, 'activity-2000-01-02.jsonl'))
    symlinkSync(join(root, 'target.txt'), join(root, 'activity-2000-01-03.jsonl'))
    retainActivity(root, now)
    const remaining = readdirSync(root)
    expect(remaining).not.toContain('activity-2000-01-01.jsonl')
    expect(remaining).not.toContain('visitor-salt-2026-11-14')
    for (const name of [
      boundary,
      'activity-2026-11-16.jsonl',
      'activity-2000-02-30.jsonl',
      'notes.txt',
      'target.txt',
      'activity-2000-01-02.jsonl',
      'activity-2000-01-03.jsonl',
      'visitor-salt-2026-11-15',
      'visitor-salt-2000-02-30',
    ])
      expect(remaining).toContain(name)
  })

  it('runs again at the next UTC day rather than on every write', () => {
    const root = directory()
    retainActivity(root, new Date('2026-11-16T06:30:00Z'))
    writeFileSync(join(root, 'activity-2000-01-01.jsonl'), 'synthetic fixture')
    retainActivity(root, new Date('2026-11-16T20:00:00Z'))
    expect(readdirSync(root)).toContain('activity-2000-01-01.jsonl')
    retainActivity(root, new Date('2026-11-17T00:00:00Z'))
    expect(readdirSync(root)).not.toContain('activity-2000-01-01.jsonl')
  })
})
