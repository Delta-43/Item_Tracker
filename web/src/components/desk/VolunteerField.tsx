import { UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { Settings } from '@/lib/types'

/** Who is on duty; recorded with every lend and return. Click to change at shift handover. */
export function VolunteerField({ settings, onChanged }: { settings: Settings; onChanged: () => void }) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(settings.volunteer)

  async function save(e?: FormEvent) {
    e?.preventDefault()
    setEditing(false)
    if (value.trim() === settings.volunteer) return
    try {
      await api.saveSettings({ ...settings, volunteer: value })
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
      setValue(settings.volunteer)
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-2">
        <UserRound className="size-4 text-mist" aria-hidden />
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setValue(settings.volunteer)
              setEditing(false)
            }
          }}
          placeholder={t('header.volunteerPlaceholder')}
          aria-label={t('header.volunteerLabel')}
          maxLength={120}
          className="h-8 w-48"
        />
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(settings.volunteer)
        setEditing(true)
      }}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-seat hover:text-foreground"
      aria-label={t('header.volunteerLabel')}
    >
      <UserRound className="size-4" aria-hidden />
      {settings.volunteer ? (
        <span>
          {t('header.onDuty')} <span className="font-medium text-foreground">{settings.volunteer}</span>
        </span>
      ) : (
        <span className="text-amber">{t('header.nobodyOnDuty')}</span>
      )}
    </button>
  )
}
