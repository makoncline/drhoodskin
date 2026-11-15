import { readFileSync } from 'node:fs'
import {
  formatActivityReport,
  readActivityRows,
  summarizeActivity,
} from '../src/server/activityReport.ts'
import { localActivityRows } from './activity-export.js'

const value = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const days = Number(value('days') ?? 7)
if (!Number.isFinite(days) || days <= 0) throw new Error('Use a positive number of days.')
const file = value('file')
const rows = file ? JSON.parse(readFileSync(file, 'utf8')) : await localActivityRows()
if (!Array.isArray(rows)) throw new Error('Expected a JSON array of exported activity rows.')
const summary = summarizeActivity(readActivityRows(rows, days))
console.log(
  process.argv.includes('--json')
    ? JSON.stringify(summary, null, 2)
    : formatActivityReport(summary, days),
)
