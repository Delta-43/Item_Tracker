import { useQuery } from '@tanstack/react-query'
import { FileUp, Search, Upload, UserMinus, UserPlus } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { nameMatches } from '@/lib/names'
import { parseRoster } from '@/lib/roster'
import type { Borrower, ImportResult, Item } from '@/lib/types'

interface RosterTabProps {
  borrowers: Borrower[]
  items: Item[]
  onChanged: () => void
}

export function RosterTab({ borrowers, items, onChanged }: RosterTabProps) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [replace, setReplace] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [query, setQuery] = useState('')
  const [single, setSingle] = useState('')
  const [showRemoved, setShowRemoved] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const names = useMemo(() => parseRoster(text), [text])

  const removed = useQuery({
    queryKey: ['borrowers', 'all', borrowers.length],
    queryFn: () => api.borrowers(true),
    enabled: showRemoved,
  })

  const holding = useMemo(() => {
    const map = new Map<number, string>()
    for (const it of items) if (it.loan) map.set(it.loan.borrower_id, it.label)
    return map
  }, [items])

  const list = useMemo(() => {
    const source = showRemoved ? (removed.data ?? []).filter((b) => !b.active) : borrowers
    return source.filter((b) => nameMatches(b.name, query))
  }, [borrowers, removed.data, showRemoved, query])

  async function runImport() {
    try {
      setResult(await api.importRoster(names, replace))
      setText('')
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function readFile(file: File) {
    setText(await file.text())
  }

  async function addOne(e: FormEvent) {
    e.preventDefault()
    try {
      const b = await api.addBorrower(single)
      toast.success(t('roster.added', { name: b.name }))
      setSingle('')
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function setActive(b: Borrower, active: boolean) {
    try {
      await api.setBorrowerActive(b.id, active)
      onChanged()
      removed.refetch()
      if (!active) {
        toast.success(t('roster.removed', { name: b.name }), {
          action: { label: t('toast.undo'), onClick: () => setActive(b, true) },
        })
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t('roster.importTitle')}</h3>
        <p className="text-sm text-mist">{t('roster.importHint')}</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={t('roster.placeholder')}
          aria-label={t('roster.importTitle')}
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <FileUp aria-hidden />
            {t('roster.chooseFile')}
          </Button>
          <span className="text-sm text-mist">{t('roster.found', { count: names.length })}</span>
        </div>
        <div className="flex items-start gap-3">
          <Switch id="replace" checked={replace} onCheckedChange={setReplace} />
          <Label htmlFor="replace" className="flex-col items-start gap-1 leading-snug font-normal">
            <span className="font-medium">{t('roster.replace')}</span>
            <span className="text-sm text-mist">{t('roster.replaceHint')}</span>
          </Label>
        </div>
        <Button className="self-start" onClick={runImport} disabled={names.length === 0}>
          <Upload aria-hidden />
          {names.length > 0 ? t('roster.import', { count: names.length }) : t('roster.importNothing')}
        </Button>
        {result && <ImportSummary result={result} />}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t('roster.listTitle', { count: borrowers.length })}</h3>
        <form onSubmit={addOne} className="flex gap-2">
          <Input value={single} onChange={(e) => setSingle(e.target.value)} placeholder={t('roster.addPlaceholder')} aria-label={t('roster.addPlaceholder')} maxLength={120} />
          <Button type="submit" variant="outline" disabled={!single.trim()}>
            <UserPlus aria-hidden />
            {t('roster.add')}
          </Button>
        </form>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-mist" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('panel.search')} className="pl-8" aria-label={t('panel.search')} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="show-removed" checked={showRemoved} onCheckedChange={setShowRemoved} />
            <Label htmlFor="show-removed" className="font-normal">
              {t('roster.showRemoved')}
            </Label>
          </div>
        </div>
        <ul className="divide-y border-y">
          {list.length === 0 && <li className="py-3 text-sm text-mist">{showRemoved ? t('roster.noneRemoved') : t('roster.empty')}</li>}
          {list.map((b) => {
            const has = holding.get(b.id)
            return (
              <li key={b.id} className="flex items-center gap-3 py-1.5">
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                {has !== undefined && <span className="text-sm text-teal">{t('panel.hasItem', { label: has })}</span>}
                {b.active ? (
                  <Button size="icon-sm" variant="ghost" disabled={has !== undefined} onClick={() => setActive(b, false)} aria-label={t('roster.remove', { name: b.name })}>
                    <UserMinus aria-hidden />
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setActive(b, true)}>
                    {t('roster.addBack')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function ImportSummary({ result }: { result: ImportResult }) {
  const { t } = useI18n()
  return (
    <div role="status" className="rounded-lg border border-teal/60 p-3 text-sm">
      <p className="font-medium">
        {t('roster.summary', { added: result.added, unchanged: result.unchanged, reactivated: result.reactivated, removed: result.deactivated })}
      </p>
      {result.kept_active.length > 0 && <p className="mt-1 text-mist">{t('roster.kept', { names: result.kept_active.join(', ') })}</p>}
      {result.invalid.length > 0 && <p className="mt-1 text-amber">{t('roster.invalid', { names: result.invalid.join(', ') })}</p>}
    </div>
  )
}
