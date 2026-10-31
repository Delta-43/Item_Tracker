import { DatabaseBackup, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { Settings } from '@/lib/types'

/** Desk-wide rules: when a loan counts as overdue, and a way to keep a copy of the data. */
export function DeskTab({ settings, onChanged }: { settings: Settings; onChanged: () => void }) {
  const { t } = useI18n()
  const [hours, setHours] = useState(String(settings.overdue_minutes / 60))
  const [closing, setClosing] = useState(settings.closing_time)
  const [saving, setSaving] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const minutes = Math.round(Number(hours.replace(',', '.')) * 60)
    if (!Number.isFinite(minutes) || minutes < 0) {
      toast.error(t('desk.invalidHours'))
      return
    }
    setSaving(true)
    try {
      await api.saveSettings({ ...settings, overdue_minutes: minutes, closing_time: closing })
      toast.success(t('desk.saved'))
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={save} className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">{t('desk.overdueTitle')}</h3>
        <p className="text-sm text-mist">{t('desk.overdueHint')}</p>
        <div className="grid grid-cols-[10rem_1fr] items-center gap-x-4 gap-y-3">
          <Label htmlFor="overdue-hours">{t('desk.limit')}</Label>
          <div className="flex items-center gap-2">
            <Input id="overdue-hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} className="w-24" />
            <span className="text-sm text-mist">{t('desk.hoursSuffix')}</span>
          </div>
          <Label htmlFor="closing-time">{t('desk.closing')}</Label>
          <div className="flex items-center gap-2">
            <Input id="closing-time" type="time" value={closing} onChange={(e) => setClosing(e.target.value)} className="w-32" />
            {closing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setClosing('')}>
                {t('desk.noClosing')}
              </Button>
            )}
          </div>
        </div>
        <Button type="submit" className="self-start" disabled={saving}>
          <Save aria-hidden />
          {t('desk.save')}
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t('desk.backupTitle')}</h3>
        <p className="text-sm text-mist">{t('desk.backupHint')}</p>
        <Button asChild variant="outline" className="self-start">
          <a href="/api/backup" download>
            <DatabaseBackup aria-hidden />
            {t('desk.backup')}
          </a>
        </Button>
      </section>
    </div>
  )
}
