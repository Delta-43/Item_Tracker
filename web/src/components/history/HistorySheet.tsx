import { useQuery } from '@tanstack/react-query'
import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { downloadText, toCsv } from '@/lib/csv'
import { useI18n } from '@/lib/i18n'
import { nameMatches } from '@/lib/names'
import { formatDuration } from '@/lib/status'
import type { Loan } from '@/lib/types'
import { cn } from '@/lib/utils'

type Range = 'today' | 'yesterday' | 'all'

function rangeParams(range: Range): Record<string, string> {
  if (range === 'all') return {}
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (range === 'yesterday') {
    const end = new Date(start)
    start.setDate(start.getDate() - 1)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  return { from: start.toISOString() }
}

interface HistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Changes whenever the desk state changes, so open history stays current. */
  version: string
}

export function HistorySheet({ open, onOpenChange, version }: HistorySheetProps) {
  const { t, locale, lang } = useI18n()
  const [range, setRange] = useState<Range>('today')
  const [query, setQuery] = useState('')
  const loans = useQuery({
    queryKey: ['loans', range, version],
    queryFn: () => api.loans(rangeParams(range)),
    enabled: open,
    placeholderData: (prev) => prev,
  })

  const rows = useMemo(
    () => (loans.data ?? []).filter((l) => nameMatches(l.borrower_name, query) || l.item_label.toLowerCase() === query.trim().toLowerCase()),
    [loans.data, query],
  )
  const stillOut = rows.filter((l) => !l.returned_at).length

  const dateTime = (iso: string) => new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const status = (l: Loan) => (l.returned_at ? (l.close_reason === 'returned' ? t('history.returned') : t(`condition.${l.close_reason as 'lost' | 'damaged'}`)) : t('history.stillOut'))
  const duration = (l: Loan) => formatDuration((l.returned_at ? new Date(l.returned_at) : new Date()).getTime() - new Date(l.lent_at).getTime())

  function exportCsv() {
    const header = [t('history.col.item'), t('history.col.borrower'), t('history.col.lent'), t('history.col.lentBy'), t('history.col.returned'), t('history.col.returnedBy'), t('history.col.duration'), t('history.col.status')]
    const body = rows.map((l) => [
      l.item_label,
      l.borrower_name,
      new Date(l.lent_at).toLocaleString(locale),
      l.lent_by,
      l.returned_at ? new Date(l.returned_at).toLocaleString(locale) : '',
      l.returned_by ?? '',
      duration(l),
      status(l),
    ])
    const stamp = new Date().toISOString().slice(0, 10)
    downloadText(`item-tracker-history-${range}-${stamp}.csv`, toCsv([header, ...body], lang === 'pl' ? ';' : ','))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-4xl">
        <SheetHeader className="border-b">
          <SheetTitle className="text-xl">{t('history.title')}</SheetTitle>
          <SheetDescription>{t('history.description')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="today">{t('history.today')}</TabsTrigger>
              <TabsTrigger value="yesterday">{t('history.yesterday')}</TabsTrigger>
              <TabsTrigger value="all">{t('history.all')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-mist" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('history.search')} aria-label={t('history.search')} className="pl-8" />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download aria-hidden />
            {t('history.export')}
          </Button>
        </div>
        <p className="px-4 pt-3 text-sm text-mist" role="status">
          {t('history.summary', { count: rows.length, out: stillOut })}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-mist">{loans.isLoading ? t('app.loading') : t('history.empty')}</p>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>{t('history.col.item')}</TableHead>
                  <TableHead>{t('history.col.borrower')}</TableHead>
                  <TableHead>{t('history.col.lent')}</TableHead>
                  <TableHead>{t('history.col.returned')}</TableHead>
                  <TableHead className="text-right">{t('history.col.duration')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-lg font-bold">{l.item_label}</TableCell>
                    <TableCell className="font-medium">{l.borrower_name}</TableCell>
                    <TableCell>
                      {dateTime(l.lent_at)}
                      {l.lent_by && <span className="block text-xs text-mist">{l.lent_by}</span>}
                    </TableCell>
                    <TableCell className={cn(!l.returned_at && 'font-medium text-teal', l.returned_at && l.close_reason !== 'returned' && 'text-amber')}>
                      {l.returned_at ? (l.close_reason === 'returned' ? dateTime(l.returned_at) : `${status(l)} · ${dateTime(l.returned_at)}`) : status(l)}
                      {l.returned_by && <span className="block text-xs text-mist">{l.returned_by}</span>}
                    </TableCell>
                    <TableCell className="text-right">{duration(l)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
