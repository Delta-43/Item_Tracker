import { UserPlus, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import type { Settings } from '@/lib/types'

/** Matches the server's limit (store.MaxVolunteers). */
const MAX_ON_DUTY = 5

/**
 * The team at the desk, up to five people. Everyone listed is recorded on
 * each lend and return, so volunteers never have to say who pressed Enter.
 */
export function OnDutyField({ settings, onChanged }: { settings: Settings; onChanged: () => void }) {
  const { t } = useI18n()
  const names = settings.volunteers
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  // The latest team, including changes still on their way to the server, so
  // two names typed in quick succession don't overwrite each other.
  const team = useRef(names)
  useEffect(() => {
    team.current = names
  }, [names])

  async function save(next: string[]) {
    team.current = next
    try {
      await api.saveSettings({ ...settings, volunteers: next })
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function add(e?: FormEvent) {
    e?.preventDefault()
    const name = value.trim()
    setValue('')
    if (!name) {
      setAdding(false)
      return
    }
    // Stay open for the next name until the team is full.
    if (team.current.length + 1 >= MAX_ON_DUTY) setAdding(false)
    await save([...team.current, name])
  }

  return (
    <div role="group" aria-label={t('header.volunteerLabel')} className="flex min-w-0 items-center gap-2 text-sm">
      <UserRound strokeWidth={1.5} className="size-4 shrink-0 text-mist" aria-hidden />
      {names.length > 0 && <span className="hidden shrink-0 text-muted-foreground xl:inline">{t('header.onDuty')}</span>}
      {names.length === 0 && !adding && (
        <button type="button" onClick={() => setAdding(true)} className="rounded-md px-1.5 py-1 text-amber transition-colors hover:bg-seat">
          {t('header.nobodyOnDuty')}
        </button>
      )}
      {names.length > 0 && (
        <ul className="flex min-w-0 items-center gap-1.5">
          {names.map((name) => (
            <li key={name} className="flex max-w-[8.5rem] shrink-0 items-center rounded-full bg-seat py-0.5 pr-0.5 pl-2.5">
              <span className="truncate font-medium" title={name}>
                {name}
              </span>
              <button
                type="button"
                onClick={() => save(team.current.filter((n) => n !== name))}
                aria-label={t('header.removeVolunteer', { name })}
                className="ml-0.5 shrink-0 rounded-full p-1 text-mist transition-colors hover:bg-seat-hover hover:text-foreground"
              >
                <X strokeWidth={1.5} className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form onSubmit={add}>
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => add()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setValue('')
                setAdding(false)
              }
            }}
            placeholder={t('header.volunteerPlaceholder')}
            aria-label={t('header.addVolunteer')}
            maxLength={120}
            className="h-8 w-40"
          />
        </form>
      ) : (
        names.length > 0 &&
        names.length < MAX_ON_DUTY && (
          <Button variant="ghost" size="icon-sm" onClick={() => setAdding(true)} aria-label={t('header.addVolunteer')}>
            <UserPlus strokeWidth={1.5} aria-hidden />
          </Button>
        )
      )}
    </div>
  )
}
