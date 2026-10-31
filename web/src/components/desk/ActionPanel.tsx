import { AlarmClock, ArrowLeftToLine, Bandage, CircleCheck, Clock3, CornerDownLeft, ScanLine, SearchX, TriangleAlert, UserRoundCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useI18n } from '@/lib/i18n'
import { nameMatches } from '@/lib/names'
import { dueAt, formatClock, formatDuration, seatStatus } from '@/lib/status'
import type { Borrower, Condition, Item, Settings } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ActionPanelProps {
  item: Item | null
  settings: Settings
  items: Item[]
  borrowers: Borrower[]
  now: Date
  busy: boolean
  onLend: (item: Item, borrower: Borrower) => void
  onReturn: (item: Item) => void
  onCondition: (item: Item, condition: Condition) => void
  onClose: () => void
}

/** What the volunteer does next: nothing selected, lend a free item, or take one back. */
export function ActionPanel(props: ActionPanelProps) {
  const { t } = useI18n()
  const { item } = props
  if (!item) return <Idle />
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <PanelTitle item={item} />
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={props.onClose} aria-label={t('panel.close')}>
          <X aria-hidden />
        </Button>
      </div>
      {item.condition !== 'ok' ? (
        <OutOfService item={item} busy={props.busy} onCondition={props.onCondition} />
      ) : item.loan ? (
        <LoanDetails item={item} settings={props.settings} now={props.now} busy={props.busy} onReturn={props.onReturn} onCondition={props.onCondition} />
      ) : (
        <LendForm key={item.id} {...props} item={item} />
      )}
    </section>
  )
}

function PanelTitle({ item }: { item: Item }) {
  const { t } = useI18n()
  return <h2 className="text-4xl leading-none font-bold tracking-[-0.03em]">{t('panel.itemTitle', { label: item.label })}</h2>
}

function Idle() {
  const { t } = useI18n()
  return (
    <section className="flex flex-1 flex-col gap-3 pt-2">
      <ScanLine className="size-8 text-teal" aria-hidden />
      <h2 className="text-2xl font-semibold">{t('panel.idleTitle')}</h2>
      <p className="max-w-[34ch] text-mist">{t('panel.idleBody')}</p>
    </section>
  )
}

function OutOfService({ item, busy, onCondition }: { item: Item; busy: boolean; onCondition: ActionPanelProps['onCondition'] }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      <p className="text-mist">{t('panel.outOfService', { condition: t(`condition.${item.condition as 'lost' | 'damaged'}`) })}</p>
      {item.note && <p className="text-sm">{item.note}</p>}
      <Button size="lg" variant="outline" disabled={busy} onClick={() => onCondition(item, 'ok')}>
        <CircleCheck aria-hidden />
        {t('panel.backInService')}
      </Button>
    </div>
  )
}

/** Marking a lent item lost or damaged closes the loan, so it asks first. */
function MarkCondition({ item, condition, busy, onCondition }: { item: Item; condition: 'lost' | 'damaged'; busy: boolean; onCondition: ActionPanelProps['onCondition'] }) {
  const { t } = useI18n()
  const name = item.loan?.borrower_name ?? ''
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy} className="text-mist">
          {condition === 'lost' ? <SearchX aria-hidden /> : <Bandage aria-hidden />}
          {t(condition === 'lost' ? 'panel.markLost' : 'panel.markDamaged')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('panel.markTitle', { label: item.label, condition: t(`condition.${condition}`) })}</AlertDialogTitle>
          <AlertDialogDescription>{t('panel.markBody', { name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('panel.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onCondition(item, condition)}>
            {t(condition === 'lost' ? 'panel.markLost' : 'panel.markDamaged')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function LoanDetails({ item, settings, now, busy, onReturn, onCondition }: { item: Item; settings: Settings; now: Date; busy: boolean; onReturn: (item: Item) => void; onCondition: ActionPanelProps['onCondition'] }) {
  const { t, locale } = useI18n()
  const loan = item.loan!
  const status = seatStatus(item, settings, now)
  const due = dueAt(new Date(loan.lent_at), settings, now)
  const StatusIcon = status === 'overdue' ? TriangleAlert : status === 'due' ? AlarmClock : Clock3
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-2xl leading-tight font-semibold">
          <span className="sr-only">{t('panel.lentTo')} </span>
          {loan.borrower_name}
        </p>
        {due && (
          <p className={cn('mt-2 flex items-center gap-2 font-medium', status === 'overdue' ? 'text-pink' : status === 'due' ? 'text-amber' : 'text-mist')}>
            <StatusIcon className="size-4" aria-hidden />
            {t(status === 'overdue' ? 'panel.overdueSince' : 'panel.dueAt', { time: formatClock(due, locale) })}
          </p>
        )}
        <p className="mt-1 text-mist">
          {t('panel.lentAt', { time: formatClock(loan.lent_at, locale), duration: formatDuration(now.getTime() - new Date(loan.lent_at).getTime()) })}
        </p>
        {loan.lent_by && <p className="text-sm text-mist">{t('panel.lentBy', { name: loan.lent_by })}</p>}
      </div>
      <Button size="lg" onClick={() => onReturn(item)} disabled={busy} autoFocus>
        <ArrowLeftToLine aria-hidden />
        {t('panel.takeBack', { label: item.label })}
        <EnterKey />
      </Button>
      <div className="flex gap-1">
        <MarkCondition item={item} condition="lost" busy={busy} onCondition={onCondition} />
        <MarkCondition item={item} condition="damaged" busy={busy} onCondition={onCondition} />
      </div>
    </div>
  )
}

function LendForm({ item, items, borrowers, busy, onLend, onClose }: ActionPanelProps & { item: Item }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string>('')
  // cmdk highlights the first row by itself. Nothing counts as picked until
  // the volunteer types or uses the arrow keys (clicking a name lends
  // directly), so a scan followed by Enter can never lend to whoever happens
  // to be first on the roster.
  const [touched, setTouched] = useState(false)
  const armed = touched || query.trim() !== ''

  // Who already holds something, so the list can say so instead of failing on submit.
  const holding = useMemo(() => {
    const map = new Map<number, string>()
    for (const it of items) if (it.loan) map.set(it.loan.borrower_id, it.label)
    return map
  }, [items])
  const matches = useMemo(() => borrowers.filter((b) => nameMatches(b.name, query)).slice(0, 60), [borrowers, query])
  const selected = armed ? (borrowers.find((b) => String(b.id) === chosen) ?? null) : null

  if (borrowers.length === 0) {
    return <p className="text-mist">{t('panel.rosterEmpty')}</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="font-medium text-teal">{t('panel.free')}</p>
      <Command
        shouldFilter={false}
        value={chosen}
        onValueChange={setChosen}
        className="min-h-[10.5rem] flex-1 rounded-lg border bg-navy-deep"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setTouched(true)
          else if (e.key === 'Enter' && !armed) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder={t('panel.search')} />
        <CommandList className="max-h-none min-h-[6rem]">
          <CommandEmpty>{t('panel.noMatch', { query })}</CommandEmpty>
          {matches.map((b) => {
            const has = holding.get(b.id)
            return (
              <CommandItem
                key={b.id}
                value={String(b.id)}
                disabled={busy || has !== undefined}
                onSelect={() => onLend(item, b)}
                className={cn('justify-between text-base', !armed && 'data-selected:bg-transparent')}
              >
                <span className="truncate">{b.name}</span>
                {has !== undefined && <span className="shrink-0 text-xs text-mist">{t('panel.hasItem', { label: has })}</span>}
              </CommandItem>
            )
          })}
        </CommandList>
      </Command>
      <div className="flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          disabled={!selected || busy || holding.has(selected.id)}
          onClick={() => selected && onLend(item, selected)}
        >
          <UserRoundCheck aria-hidden />
          <span className="truncate">{selected ? t('panel.lendTo', { label: item.label, name: selected.name }) : t('panel.lend', { label: item.label })}</span>
          {selected && <EnterKey />}
        </Button>
        <Button size="lg" variant="outline" onClick={onClose}>
          {t('panel.cancel')}
        </Button>
      </div>
    </div>
  )
}

/** Shows that Enter triggers this action, for volunteers who keep their hands on the keyboard. */
function EnterKey() {
  return (
    <kbd aria-hidden className="ml-auto inline-flex h-5 items-center rounded border border-navy/30 px-1 font-sans">
      <CornerDownLeft className="size-3.5" />
    </kbd>
  )
}
