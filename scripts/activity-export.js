import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function localActivityRows(
  directory = process.env.LOG_DIR ?? '.data/logs',
  { days = 0, strict = true } = {},
) {
  const since = days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined
  let files
  try {
    files = readdirSync(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const rows = []
  let invalidLines = 0,
    unreadableFiles = 0
  for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
    const day = /^activity-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(file.name)?.[1]
    if (!file.isFile() || !day || (since && day < since.slice(0, 10))) continue
    const date = new Date(`${day}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) continue
    let text
    try {
      text = readFileSync(join(directory, file.name), 'utf8')
    } catch (error) {
      if (strict) throw error
      unreadableFiles += 1
      continue
    }
    for (const [index, line] of text.split('\n').entries()) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line)
        if (
          !row ||
          typeof row !== 'object' ||
          Array.isArray(row) ||
          typeof row.t !== 'string' ||
          !Number.isFinite(Date.parse(row.t))
        )
          throw new Error('Invalid activity row')
        if (!since || row.t >= since) rows.push(row)
      } catch {
        if (strict) throw new Error(`Invalid activity JSONL at ${file.name}:${index + 1}`)
        invalidLines += 1
      }
    }
  }
  if (invalidLines || unreadableFiles)
    console.error(
      `Activity report skipped ${invalidLines} invalid ${invalidLines === 1 ? 'line' : 'lines'} and ${unreadableFiles} unreadable ${unreadableFiles === 1 ? 'file' : 'files'}.`,
    )
  return rows.sort((a, b) => a.t.localeCompare(b.t))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] ?? '.local/activity.json'
  const rows = localActivityRows()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(rows, null, 2), { flag: 'wx', mode: 0o600 })
  console.log(`Exported ${rows.length} activity rows to ${path}`)
}
