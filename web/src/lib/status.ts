import type { Item, Settings } from './types'

export type SeatStatus = 'free' | 'out' | 'due' | 'overdue' | 'out_of_service'

/** How close to the limit a loan turns "due soon": the last 30 minutes, or the last quarter for short limits. */
function warningWindow(limitMinutes: number) {
  return Math.min(30, limitMinutes / 4)
}

/** Today's closing time as a Date in local time, or null when none is set. */
export function closingAt(settings: Settings, now: Date): Date | null {
  const m = /^(\d\d):(\d\d)$/.exec(settings.closing_time)
  if (!m) return null
  const d = new Date(now)
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return d
}

/** When an open loan becomes overdue: the earlier of the duration limit and closing time. */
export function dueAt(lentAt: Date, settings: Settings, now: Date): Date | null {
  const candidates: Date[] = []
  if (settings.overdue_minutes > 0) candidates.push(new Date(lentAt.getTime() + settings.overdue_minutes * 60_000))
  const closing = closingAt(settings, now)
  if (closing && closing > lentAt) candidates.push(closing)
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (a < b ? a : b))
}

export function seatStatus(item: Item, settings: Settings, now: Date): SeatStatus {
  if (item.condition !== 'ok') return 'out_of_service'
  if (!item.loan) return 'free'
  const due = dueAt(new Date(item.loan.lent_at), settings, now)
  if (!due) return 'out'
  if (now >= due) return 'overdue'
  const windowMs = warningWindow(settings.overdue_minutes || 120) * 60_000
  return due.getTime() - now.getTime() <= windowMs ? 'due' : 'out'
}

/** "2h 14m", "21m", "<1m". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return '<1m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatClock(iso: string | Date, locale?: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}
