import { Boxes, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

/** First run: no items yet, so teach the next step instead of showing an empty grid. */
export function EmptyDesk({ onManage, onChanged }: { onManage: () => void; onChanged: () => void }) {
  const { t } = useI18n()
  const [count, setCount] = useState(10)
  const [busy, setBusy] = useState(false)

  async function quickAdd() {
    setBusy(true)
    try {
      for (let n = 1; n <= count; n++) await api.createItem(String(n))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
      onChanged()
    }
  }

  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-4 p-8">
      <h2 className="text-3xl font-semibold">{t('empty.title')}</h2>
      <p className="max-w-[48ch] text-mist">{t('empty.body')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="number"
          min={1}
          max={200}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
          className="w-20"
          aria-label={t('items.count', { count: '' }).trim()}
        />
        <Button size="lg" onClick={quickAdd} disabled={busy}>
          <Plus aria-hidden />
          {t('empty.quickAdd', { count })}
        </Button>
        <Button size="lg" variant="outline" onClick={onManage}>
          <Boxes aria-hidden />
          {t('empty.manage')}
        </Button>
      </div>
    </div>
  )
}
