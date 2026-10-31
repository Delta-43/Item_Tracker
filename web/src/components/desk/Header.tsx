import { Boxes, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import type { Settings } from '@/lib/types'
import { OnDutyField } from './OnDutyField'

export function Header({ settings, onManage, onHistory, onChanged }: { settings: Settings; onManage: () => void; onHistory: () => void; onChanged: () => void }) {
  const { t } = useI18n()
  const labels = settings.labels[settings.language]
  return (
    <header className="flex h-16 shrink-0 items-center gap-5 border-b px-6">
      {settings.branding === '42warsaw' && (
        <img src="/branding/42warsaw-logo-white.png" alt="42 Warsaw" className="h-9 w-auto" />
      )}
      <h1 className="shrink-0 text-lg font-semibold tracking-[0.12em] uppercase">{labels.desk}</h1>
      <div className="min-w-4 flex-1" />
      <OnDutyField settings={settings} onChanged={onChanged} />
      {/* Labels fold to icons below 1280px so a full team of five still fits. */}
      <Button variant="outline" onClick={onHistory} aria-label={t('history.open')} className="shrink-0">
        <History aria-hidden />
        <span className="hidden xl:inline">{t('history.open')}</span>
      </Button>
      <Button variant="outline" onClick={onManage} aria-label={t('header.manage')} className="shrink-0">
        <Boxes aria-hidden />
        <span className="hidden xl:inline">{t('header.manage')}</span>
      </Button>
    </header>
  )
}
