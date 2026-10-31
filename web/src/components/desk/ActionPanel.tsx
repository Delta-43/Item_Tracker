import { ArrowLeftToLine, ScanLine, UserRoundCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useI18n } from '@/lib/i18n'
import { nameMatches } from '@/lib/names'
import { formatClock, formatDuration } from '@/lib/status'
import type { Borrower, Item } from '@/lib/types'

interface ActionPanelProps {
  item: Item | null
  items: Item[]
  borrowers: Borrower[]
  now: Date
  busy: boolean
  onLend: (item: Item, borrower: Borrower) => void
  onReturn: (item: Item) => void
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
        <OutOfService item={item} />
      ) : item.loan ? (
        <LoanDetails item={item} now={props.now} busy={props.busy} onReturn={props.onReturn} />
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

function OutOfService({ item }: { item: Item }) {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <p className="text-mist">{t('panel.outOfService', { condition: t(`condition.${item.condition as 'lost' | 'damaged'}`) })}</p>
      {item.note && <p className="text-sm">{item.note}</p>}
    </div>
  )
}

function LoanDetails({ item, now, busy, onReturn }: { item: Item; now: Date; busy: boolean; onReturn: (item: Item) => void }) {
  const { t, locale } = useI18n()
  const loan = item.loan!
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-mist">{t('panel.lentTo')}</p>
        <p className="text-2xl leading-tight font-semibold">{loan.borrower_name}</p>
        <p className="mt-1 text-mist">
          {t('panel.lentAt', { time: formatClock(loan.lent_at, locale), duration: formatDuration(now.getTime() - new Date(loan.lent_at).getTime()) })}
        </p>
        {loan.lent_by && <p className="text-sm text-mist">{t('panel.lentBy', { name: loan.lent_by })}</p>}
      </div>
      <Button size="lg" onClick={() => onReturn(item)} disabled={busy} autoFocus>
        <ArrowLeftToLine aria-hidden />
        {t('panel.takeBack', { label: item.label })}
      </Button>
    </div>
  )
}

function LendForm({ item, items, borrowers, busy, onLend, onClose }: ActionPanelProps & { item: Item }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string>('')

  // Who already holds something, so the list can say so instead of failing on submit.
  const holding = useMemo(() => {
    const map = new Map<number, string>()
    for (const it of items) if (it.loan) map.set(it.loan.borrower_id, it.label)
    return map
  }, [items])
  const matches = useMemo(() => borrowers.filter((b) => nameMatches(b.name, query)).slice(0, 60), [borrowers, query])
  const selected = borrowers.find((b) => String(b.id) === chosen) ?? null

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
        className="min-h-0 flex-1 rounded-lg border bg-navy-deep"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder={t('panel.search')} />
        <CommandList className="max-h-none">
          <CommandEmpty>{t('panel.noMatch', { query })}</CommandEmpty>
          {matches.map((b) => {
            const has = holding.get(b.id)
            return (
              <CommandItem
                key={b.id}
                value={String(b.id)}
                disabled={busy || has !== undefined}
                onSelect={() => onLend(item, b)}
                className="justify-between text-base"
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
          {selected ? t('panel.lendTo', { label: item.label, name: selected.name }) : t('panel.lend', { label: item.label })}
        </Button>
        <Button size="lg" variant="outline" onClick={onClose}>
          {t('panel.cancel')}
        </Button>
      </div>
    </div>
  )
}
