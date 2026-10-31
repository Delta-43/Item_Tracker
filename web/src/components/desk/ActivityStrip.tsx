import { ArrowDownLeft, ArrowUpRight, Ban } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { formatClock } from '@/lib/status'
import type { Activity } from '@/lib/types'

export function ActivityStrip({ recent }: { recent: Activity[] }) {
  const { t, locale } = useI18n()
  return (
    <footer className="flex h-14 shrink-0 items-center gap-7 overflow-hidden border-t px-6 text-sm whitespace-nowrap">
      <h2 className="font-semibold text-mist">{t('activity.title')}</h2>
      {recent.length === 0 && <p className="text-mist">{t('activity.none')}</p>}
      <ol className="flex min-w-0 flex-1 gap-7 [mask-image:linear-gradient(to_right,black_85%,transparent)]">
        {recent.slice(0, 8).map((a) => {
          const Icon = a.kind === 'lent' ? ArrowUpRight : a.kind === 'returned' ? ArrowDownLeft : Ban
          const verb =
            a.kind === 'lent' ? t('activity.lent') : a.kind === 'returned' ? t('activity.returned') : t('activity.closed', { condition: t(`condition.${a.kind}`) })
          return (
            <li key={`${a.kind}-${a.loan.id}`} className="flex items-center gap-2">
              <time dateTime={a.at} className="text-mist">
                {formatClock(a.at, locale)}
              </time>
              <Icon className={a.kind === 'lent' ? 'size-4 text-teal' : 'size-4 text-mist'} aria-hidden />
              <span>
                <span className="font-semibold">
                  {t('panel.itemTitle', { label: a.loan.item_label })}
                </span>{' '}
                {verb} {a.loan.borrower_name}
              </span>
            </li>
          )
        })}
      </ol>
    </footer>
  )
}
