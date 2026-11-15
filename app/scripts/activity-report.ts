import { formatActivityReport, readActivity, summarizeActivity } from '../src/server/activityReport.ts'

const daysArg = process.argv.find((arg) => arg.startsWith('--days='))
const days = daysArg ? Number(daysArg.slice('--days='.length)) : 7
const logDir = process.env.LOG_DIR ?? '.data/logs'
const summary = summarizeActivity(readActivity(logDir, days))

console.log(process.argv.includes('--json') ? JSON.stringify(summary, null, 2) : formatActivityReport(summary, days))
