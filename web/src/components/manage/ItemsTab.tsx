import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { Item } from '@/lib/types'

export function ItemsTab({ items, onChanged }: { items: Item[]; onChanged: () => void }) {
  const { t } = useI18n()
  const [label, setLabel] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

  async function add(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createItem(label, code)
      setLabel('')
      setCode('')
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-mist">{t('items.description')}</p>
      <form onSubmit={add} className="grid grid-cols-[6rem_1fr] items-end gap-x-2 gap-y-3">
        <div className="grid gap-1.5">
          <Label htmlFor="new-label">{t('items.addLabel')}</Label>
          <Input id="new-label" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-code">{t('items.addCode')}</Label>
          <Input id="new-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('items.addCodeHint')} maxLength={200} />
        </div>
        <Button type="submit" className="col-span-2 justify-self-start" disabled={saving || !label.trim()}>
          <Plus aria-hidden />
          {t('items.add')}
        </Button>
      </form>

      <div>
        <p className="mb-2 text-sm text-mist">{t('items.count', { count: items.length })}</p>
        <ul className="divide-y border-y">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} onChanged={onChanged} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function ItemRow({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(item.label)
  const [code, setCode] = useState(item.code)

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      setEditing(false)
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 py-2">
        <Input aria-label={t('items.addLabel')} value={label} onChange={(e) => setLabel(e.target.value)} className="w-20" />
        <Input aria-label={t('items.addCode')} value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 font-mono text-sm" />
        <Button size="icon-sm" onClick={() => run(() => api.updateItem(item.id, { label, code }))} aria-label={t('items.save')}>
          <Check aria-hidden />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setEditing(false)} aria-label={t('panel.cancel')}>
          <X aria-hidden />
        </Button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-14 text-2xl font-bold tracking-[-0.03em]">{item.label}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm text-mist" title={item.code}>
          {item.code}
        </span>
        {item.loan && <span className="block truncate text-sm">{t('items.out', { name: item.loan.borrower_name })}</span>}
        {item.condition !== 'ok' && <span className="block text-sm text-amber">{t(`condition.${item.condition}`)}</span>}
      </span>
      <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`${t('items.edit')} ${item.label}`}>
        <Pencil aria-hidden />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`${t('items.delete')} ${item.label}`}>
            <Trash2 aria-hidden />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('items.deleteTitle', { label: item.label })}</AlertDialogTitle>
            <AlertDialogDescription>{t('items.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('panel.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => run(() => api.deleteItem(item.id))}>
              {t('items.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}
