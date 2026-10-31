import { Boxes, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import type { Settings } from '@/lib/types'

export function Header({ settings, onManage }: { settings: Settings; onManage: () => void }) {
  const { t } = useI18n()
  const labels = settings.labels[settings.language]
  return (
    <header className="flex h-16 shrink-0 items-center gap-5 border-b px-6">
      {settings.branding === '42warsaw' && (
        <img src="/branding/42warsaw-logo-white.png" alt="42 Warsaw" className="h-9 w-auto" />
      )}
      <h1 className="text-lg font-semibold tracking-[0.12em] uppercase">{labels.desk}</h1>
      <div className="flex-1" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserRound className="size-4" aria-hidden />
        {settings.volunteer ? (
          <span>
            {t('header.onDuty')} <span className="font-medium text-foreground">{settings.volunteer}</span>
          </span>
        ) : (
          <span>{t('header.nobodyOnDuty')}</span>
        )}
      </div>
      <Button variant="outline" onClick={onManage}>
        <Boxes aria-hidden />
        {t('header.manage')}
      </Button>
    </header>
  )
}
