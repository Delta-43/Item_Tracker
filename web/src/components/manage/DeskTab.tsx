import { ArchiveRestore, DatabaseBackup, Save } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
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
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { Labels, Language, Settings } from '@/lib/types'

/** Desk-wide rules: when a loan counts as overdue, and a way to keep and restore a copy of the data. */
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

      <WordingForm key={JSON.stringify([settings.language, settings.branding, settings.labels])} settings={settings} onChanged={onChanged} />

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t('desk.backupTitle')}</h3>
        <p className="text-sm text-mist">{t('desk.backupHint')}</p>
        <p className="text-sm text-mist">{t('desk.restoreHint')}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <a href="/api/backup" download>
              <DatabaseBackup aria-hidden />
              {t('desk.backup')}
            </a>
          </Button>
          <RestoreButton onChanged={onChanged} />
        </div>
      </section>
    </div>
  )
}

const restoreErrors = {
  not_a_backup: 'desk.notBackup',
  backup_too_new: 'desk.backupTooNew',
  backup_damaged: 'desk.backupDamaged',
} as const

/** Picks a backup file, confirms, and replaces the desk's data with it. */
function RestoreButton({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [restoring, setRestoring] = useState(false)

  async function restore() {
    if (!file) return
    setRestoring(true)
    try {
      const { saved } = await api.restore(file)
      toast.success(t('desk.restored', { file: saved }))
      onChanged()
    } catch (err) {
      const key = err instanceof ApiError ? restoreErrors[err.code as keyof typeof restoreErrors] : undefined
      toast.error(key ? t(key) : (err as Error).message)
    } finally {
      setRestoring(false)
      setFile(null)
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".db,.sqlite,application/vnd.sqlite3"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <Button variant="outline" disabled={restoring} onClick={() => input.current?.click()}>
        <ArchiveRestore aria-hidden />
        {restoring ? t('desk.restoring') : t('desk.restore')}
      </Button>
      <AlertDialog open={file !== null && !restoring} onOpenChange={(open) => !open && setFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('desk.restoreTitle', { file: file?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('desk.restoreBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('panel.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={restore}>
              {t('desk.restoreConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const labelFields: [keyof Labels, 'desk.labelItem' | 'desk.labelItems' | 'desk.labelBorrower' | 'desk.labelBorrowers' | 'desk.labelDesk'][] = [
  ['item', 'desk.labelItem'],
  ['items', 'desk.labelItems'],
  ['borrower', 'desk.labelBorrower'],
  ['borrowers', 'desk.labelBorrowers'],
  ['desk', 'desk.labelDesk'],
]

/** Language, logo and the nouns the desk uses, so it can track any kind of item. */
function WordingForm({ settings, onChanged }: { settings: Settings; onChanged: () => void }) {
  const { t } = useI18n()
  const [language, setLanguage] = useState<Language>(settings.language)
  const [branding, setBranding] = useState(settings.branding)
  const [labels, setLabels] = useState(settings.labels)
  const [saving, setSaving] = useState(false)
  const current = labels[language]

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.saveSettings({ ...settings, language, branding, labels })
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{t('desk.wordingTitle')}</h3>
      <p className="text-sm text-mist">{t('desk.wordingHint')}</p>
      <div className="grid grid-cols-[10rem_1fr] items-center gap-x-4 gap-y-3">
        <Label htmlFor="language">{t('desk.language')}</Label>
        <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
          <SelectTrigger id="language" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="pl">Polski</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="branding">{t('desk.branding')}</Label>
        <Select value={branding} onValueChange={(v) => setBranding(v as Settings['branding'])}>
          <SelectTrigger id="branding" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="42warsaw">42 Warsaw</SelectItem>
            <SelectItem value="none">{t('desk.brandingNone')}</SelectItem>
          </SelectContent>
        </Select>
        {labelFields.map(([field, key]) => (
          <div key={field} className="contents">
            <Label htmlFor={`label-${field}`}>{t(key)}</Label>
            <Input
              id={`label-${field}`}
              value={current[field]}
              maxLength={40}
              required
              onChange={(e) => setLabels({ ...labels, [language]: { ...current, [field]: e.target.value } })}
              className="w-64"
            />
          </div>
        ))}
      </div>
      <Button type="submit" className="self-start" disabled={saving}>
        <Save aria-hidden />
        {t('desk.saveWording')}
      </Button>
    </form>
  )
}
