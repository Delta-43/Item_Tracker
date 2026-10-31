import { AlarmClock, Ban, CircleDashed, Clock3, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'
import { dueAt, formatClock, formatDuration, seatStatus, type SeatStatus } from '@/lib/status'
import type { Item, Settings } from '@/lib/types'
import { cn } from '@/lib/utils'

const statuses: SeatStatus[] = ['free', 'out', 'due', 'overdue', 'out_of_service']

const icons: Record<SeatStatus, LucideIcon> = {
  free: CircleDashed,
  out: Clock3,
  due: AlarmClock,
  overdue: TriangleAlert,
  out_of_service: Ban,
}

const seatStyles: Record<SeatStatus, string> = {
  free: 'border-2 border-dashed border-line bg-transparent hover:bg-seat/60',
  out: 'border-2 border-teal bg-seat hover:bg-seat-hover',
  due: 'border-2 border-amber bg-seat hover:bg-seat-hover',
  // Navy on pink keeps the overdue tile readable (about 5:1); white was 3.2:1.
  overdue: 'border-2 border-pink bg-pink text-navy hover:brightness-105',
  out_of_service: 'border-2 border-line text-mist bg-[repeating-linear-gradient(135deg,var(--seat)_0_12px,var(--navy-deep)_12px_24px)]',
}

const iconStyles: Record<SeatStatus, string> = {
  free: 'text-mist',
  out: 'text-teal',
  due: 'text-amber',
  overdue: 'text-navy',
  out_of_service: 'text-mist',
}

export function Legend({ items, settings, now }: { items: Item[]; settings: Settings; now: Date }) {
  const { t } = useI18n()
  const counts: Record<SeatStatus, number> = { free: 0, out: 0, due: 0, overdue: 0, out_of_service: 0 }
  for (const it of items) counts[seatStatus(it, settings, now)]++
  const entries: [SeatStatus, string][] = [
    ['free', t('legend.free', { count: counts.free })],
    ['out', t('legend.out', { count: counts.out })],
    ['due', t('legend.due', { count: counts.due })],
    ['overdue', t('legend.overdue', { count: counts.overdue })],
    ['out_of_service', t('legend.outOfService', { count: counts.out_of_service })],
  ]
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-mist" aria-live="polite">
      {entries
        .filter(([status], i) => i < 2 || counts[status] > 0)
        .map(([status, text]) => {
          const Icon = icons[status]
          return (
            <li key={status} className="flex items-center gap-1.5">
              <Icon strokeWidth={1.5} className={cn('size-4', status === 'overdue' ? 'text-pink' : iconStyles[status])} aria-hidden />
              {text}
            </li>
          )
        })}
    </ul>
  )
}

/**
 * Up to 10 items the map fills the space as a fixed board (two rows of five
 * for 10), so every seat is visible without scrolling. Larger sets keep at
 * most three rows on screen and scroll beyond that.
 */
function boardShape(n: number): { cols: number; rows: number } | null {
  if (n <= 10) {
    const cols = Math.min(5, Math.max(1, Math.ceil(n / 2)))
    return { cols, rows: Math.max(1, Math.ceil(n / cols)) }
  }
  return n <= 15 ? { cols: 5, rows: 3 } : null
}

interface SeatGridProps {
  items: Item[]
  settings: Settings
  now: Date
  selectedId: number | null
  flash: { id: number; key: number } | null
  onSelect: (item: Item) => void
}

export function SeatGrid({ items, settings, now, selectedId, flash, onSelect }: SeatGridProps) {
  const shape = boardShape(items.length)
  return (
    <div
      className={cn(
        'grid min-h-0 flex-1 gap-3 p-1',
        !shape && 'auto-rows-[minmax(9rem,12rem)] grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] overflow-y-auto',
      )}
      style={shape ? { gridTemplateColumns: `repeat(${shape.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${shape.rows}, minmax(0, 1fr))` } : undefined}
    >
      {items.map((item) => (
        <Seat
          key={item.id}
          item={item}
          settings={settings}
          now={now}
          selected={item.id === selectedId}
          flashKey={flash?.id === item.id ? flash.key : undefined}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

interface SeatProps {
  item: Item
  settings: Settings
  now: Date
  selected: boolean
  flashKey?: number
  onSelect: (item: Item) => void
}

function Seat({ item, settings, now, selected, flashKey, onSelect }: SeatProps) {
  const { t, locale } = useI18n()
  const ring = useRef<HTMLSpanElement>(null)
  const status = seatStatus(item, settings, now)
  const loan = item.loan
  const duration = loan ? formatDuration(now.getTime() - new Date(loan.lent_at).getTime()) : ''
  const due = loan ? dueAt(new Date(loan.lent_at), settings, now) : null

  // The signature move: a thin ring expands and fades on the seat that just
  // changed. Replayed with the Web Animations API so the button never remounts
  // (which would drop keyboard focus) and only opacity and transform animate.
  useEffect(() => {
    const el = ring.current
    if (flashKey === undefined || !el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.getAnimations().forEach((a) => a.cancel())
    el.animate(
      reduce ? [{ opacity: 0.9 }, { opacity: 0 }] : [{ opacity: 0.9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }],
      { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }, // --ease-out
    )
  }, [flashKey])

  let aria: string
  if (status === 'out_of_service') aria = t('seat.aria.outOfService', { label: item.label, condition: t(`condition.${item.condition as 'lost' | 'damaged'}`) })
  else if (!loan) aria = t('seat.aria.free', { label: item.label })
  else aria = t(status === 'overdue' ? 'seat.aria.overdue' : 'seat.aria.out', { label: item.label, name: loan.borrower_name, duration })

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-label={aria}
      aria-pressed={selected}
      className={cn(
        'motion-press @container relative flex min-h-0 min-w-0 flex-col rounded-xl p-3 text-left @[11rem]:p-4',
        'outline-3 outline-offset-3 outline-transparent focus-visible:outline-teal',
        seatStyles[status],
        selected && 'outline-white focus-visible:outline-white',
      )}
    >
      <span ref={ring} aria-hidden className="pointer-events-none absolute -inset-1 rounded-[calc(var(--radius-xl)+4px)] border-2 border-white opacity-0" />
      <StatusIcon status={status} />
      <span className="text-[clamp(2.5rem,26cqh,4.5rem)] leading-none font-bold tracking-[-0.04em]">{item.label}</span>
      <span className="mt-auto min-w-0 pt-2">
        {status === 'out_of_service' ? (
          <span className="block font-semibold">{t(item.condition === 'lost' ? 'seat.lost' : 'seat.damaged')}</span>
        ) : loan ? (
          <>
            <span className="line-clamp-2 text-base leading-tight font-semibold text-balance @[11rem]:text-lg" title={loan.borrower_name}>
              {loan.borrower_name}
            </span>
            <span className={cn('mt-1 block text-sm', status === 'overdue' ? 'font-medium text-navy' : status === 'due' ? 'text-amber' : 'text-mist')}>
              {duration}
              {' · '}
              {status === 'overdue'
                ? t('seat.overdue')
                : status === 'due' && due
                  ? t('seat.dueAt', { time: formatClock(due, locale) })
                  : t('seat.since', { time: formatClock(loan.lent_at, locale) })}
            </span>
          </>
        ) : (
          <span className="block text-sm font-semibold tracking-[0.14em] text-teal uppercase">{t('seat.free')}</span>
        )}
      </span>
    </button>
  )
}

/** All five state icons stay mounted and cross-fade, so a state change reads as a change, not a jump. */
function StatusIcon({ status }: { status: SeatStatus }) {
  return (
    <span aria-hidden className="absolute top-3 right-3 size-5 @[11rem]:top-4 @[11rem]:right-4">
      {statuses.map((s) => {
        const Icon = icons[s]
        return (
          <Icon
            key={s}
            className={cn(
              'absolute inset-0 size-5 transition-[opacity,filter,scale] duration-300 ease-(--ease-icon)',
              iconStyles[s],
              s === status ? 'blur-0 scale-100 opacity-100' : 'scale-[0.25] opacity-0 blur-[4px]',
            )}
          />
        )
      })}
    </span>
  )
}
