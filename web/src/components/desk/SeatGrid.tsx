import { AlarmClock, Ban, CircleDashed, Clock3, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { dueAt, formatClock, formatDuration, seatStatus, type SeatStatus } from '@/lib/status'
import type { Item, Settings } from '@/lib/types'
import { cn } from '@/lib/utils'

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
  overdue: 'border-2 border-pink bg-pink text-white hover:brightness-110',
  out_of_service: 'border-2 border-line text-mist bg-[repeating-linear-gradient(135deg,var(--seat)_0_12px,var(--navy-deep)_12px_24px)]',
}

const iconStyles: Record<SeatStatus, string> = {
  free: 'text-mist',
  out: 'text-teal',
  due: 'text-amber',
  overdue: 'text-white',
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
              <Icon className={cn('size-4', status === 'overdue' ? 'text-pink' : iconStyles[status])} aria-hidden />
              {text}
            </li>
          )
        })}
    </ul>
  )
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
  return (
    <div className="grid min-h-0 flex-1 auto-rows-[minmax(9.5rem,16rem)] content-start grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3 overflow-y-auto p-1">
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
  const status = seatStatus(item, settings, now)
  const Icon = icons[status]
  const loan = item.loan
  const duration = loan ? formatDuration(now.getTime() - new Date(loan.lent_at).getTime()) : ''
  const due = loan ? dueAt(new Date(loan.lent_at), settings, now) : null

  let aria: string
  if (status === 'out_of_service') aria = t('seat.aria.outOfService', { label: item.label, condition: t(`condition.${item.condition as 'lost' | 'damaged'}`) })
  else if (!loan) aria = t('seat.aria.free', { label: item.label })
  else aria = t(status === 'overdue' ? 'seat.aria.overdue' : 'seat.aria.out', { label: item.label, name: loan.borrower_name, duration })

  return (
    <button
      type="button"
      key={flashKey}
      onClick={() => onSelect(item)}
      aria-label={aria}
      aria-pressed={selected}
      className={cn(
        'relative flex min-w-0 flex-col rounded-xl p-4 text-left transition-[background-color,filter,outline-color] duration-200',
        'outline-3 outline-offset-3 outline-transparent focus-visible:outline-teal',
        seatStyles[status],
        selected && 'outline-white focus-visible:outline-white',
        flashKey !== undefined && 'animate-seat-flash',
      )}
    >
      <Icon className={cn('absolute top-4 right-4 size-5', iconStyles[status])} aria-hidden />
      <span className="text-6xl leading-none font-bold tracking-[-0.04em]">{item.label}</span>
      <span className="mt-auto min-w-0 pt-3">
        {status === 'out_of_service' ? (
          <span className="block font-semibold">{t(item.condition === 'lost' ? 'seat.lost' : 'seat.damaged')}</span>
        ) : loan ? (
          <>
            <span className="block truncate text-lg leading-tight font-semibold" title={loan.borrower_name}>
              {loan.borrower_name}
            </span>
            <span className={cn('mt-1 block text-sm', status === 'overdue' ? 'text-white' : status === 'due' ? 'text-amber' : 'text-mist')}>
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
