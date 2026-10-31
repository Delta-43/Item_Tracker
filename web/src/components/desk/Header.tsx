import { Boxes } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import type { Settings } from '@/lib/types'
import { VolunteerField } from './VolunteerField'

export function Header({ settings, onManage, onChanged }: { settings: Settings; onManage: () => void; onChanged: () => void }) {
  const { t } = useI18n()
  const labels = settings.labels[settings.language]
  return (
    <header className="flex h-16 shrink-0 items-center gap-5 border-b px-6">
      {settings.branding === '42warsaw' && (
        <img src="/branding/42warsaw-logo-white.png" alt="42 Warsaw" className="h-9 w-auto" />
      )}
      <h1 className="text-lg font-semibold tracking-[0.12em] uppercase">{labels.desk}</h1>
      <div className="flex-1" />
      <VolunteerField key={settings.volunteer} settings={settings} onChanged={onChanged} />
      <Button variant="outline" onClick={onManage}>
        <Boxes aria-hidden />
        {t('header.manage')}
      </Button>
    </header>
  )
}
