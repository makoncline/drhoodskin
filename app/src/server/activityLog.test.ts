import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeActivity } from './activityLog.ts'

const dirs: string[] = []

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

function temporaryDirectory() {
  const dir = mkdtempSync(join(tmpdir(), 'activity-retention-'))
  dirs.push(dir)
  return dir
}

function writeEntry(dir: string) {
  const entry = {
    t: new Date().toISOString(),
    k: 'request' as const,
    p: '/',
    a: 'human' as const,
  }
  writeActivity(entry, dir)
  return `${JSON.stringify(entry)}\n`
}

describe('activity log retention', () => {
  it('removes only expired daily files and keeps the inclusive UTC boundary', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T23:59:59Z'))
    const dir = temporaryDirectory()
    const outside = temporaryDirectory()
    const old = join(dir, 'activity-2026-05-18.jsonl')
    const boundary = join(dir, 'activity-2026-05-19.jsonl')
    const recent = join(dir, 'activity-2026-11-14.jsonl')
    const today = join(dir, 'activity-2026-11-15.jsonl')
    const untouched = [
      join(dir, 'notes.txt'),
      join(dir, 'activity-2020-01-01.jsonl.bak'),
      join(dir, 'activity-2020-02-30.jsonl'),
      join(outside, 'activity-2020-01-01.jsonl'),
    ]
    for (const file of [old, boundary, recent, today, ...untouched])
      writeFileSync(file, 'keep\n')
    utimesSync(old, new Date(), new Date())
    utimesSync(boundary, new Date(0), new Date(0))
    const subdirectory = join(dir, 'activity-2020-01-02.jsonl')
    mkdirSync(subdirectory)
    const nested = join(subdirectory, 'activity-2020-01-01.jsonl')
    writeFileSync(nested, 'keep\n')
    const fileLink = join(dir, 'activity-2020-01-03.jsonl')
    const directoryLink = join(dir, 'activity-2020-01-04.jsonl')
    symlinkSync(untouched[3], fileLink)
    symlinkSync(outside, directoryLink)

    const line = writeEntry(dir)

    await vi.waitFor(() => expect(existsSync(old)).toBe(false))
    for (const file of [boundary, recent, nested, ...untouched])
      expect(readFileSync(file, 'utf8')).toBe('keep\n')
    expect(readFileSync(today, 'utf8')).toBe(`keep\n${line}`)
    expect(lstatSync(subdirectory).isDirectory()).toBe(true)
    expect(lstatSync(fileLink).isSymbolicLink()).toBe(true)
    expect(lstatSync(directoryLink).isSymbolicLink()).toBe(true)

    writeFileSync(old, 'keep until tomorrow\n')
    writeEntry(dir)
    expect(readFileSync(old, 'utf8')).toBe('keep until tomorrow\n')

    vi.setSystemTime(new Date('2026-11-16T00:00:00Z'))
    const nextLine = writeEntry(dir)
    await vi.waitFor(() => {
      expect(existsSync(old)).toBe(false)
      expect(existsSync(boundary)).toBe(false)
    })
    expect(readFileSync(recent, 'utf8')).toBe('keep\n')
    expect(readFileSync(join(dir, 'activity-2026-11-16.jsonl'), 'utf8')).toBe(
      nextLine,
    )
  })

  it('writes entries when cleanup cannot read the directory', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'))
    const dir = temporaryDirectory()
    const old = join(dir, 'activity-2020-01-01.jsonl')
    writeFileSync(old, 'keep\n')
    chmodSync(dir, 0o300)

    try {
      const firstLine = writeEntry(dir)
      await vi.waitFor(() =>
        expect(errors).toHaveBeenCalledWith(
          'Activity log cleanup failed',
          expect.objectContaining({ code: 'EACCES' }),
        ),
      )
      const secondLine = writeEntry(dir)
      expect(readFileSync(join(dir, 'activity-2026-11-15.jsonl'), 'utf8')).toBe(
        firstLine + secondLine,
      )
      expect(readFileSync(old, 'utf8')).toBe('keep\n')
      expect(errors).toHaveBeenCalledTimes(1)
    } finally {
      chmodSync(dir, 0o700)
    }
  })
})
