import { CameraOff, RotateCw } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { useScanner, type CameraStatus } from '@/scanner/useScanner'
import { cn } from '@/lib/utils'

const problems: Partial<Record<CameraStatus, [MessageKey, MessageKey]>> = {
  denied: ['camera.denied', 'camera.deniedHint'],
  missing: ['camera.missing', 'camera.missingHint'],
  busy: ['camera.busy', 'camera.busyHint'],
  error: ['camera.error', 'camera.missingHint'],
}

export function CameraPanel({ onCode }: { onCode: (code: string) => void }) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanner = useScanner(videoRef, onCode)
  const problem = problems[scanner.status]

  return (
    <section aria-label={t('camera.preview')} className="flex shrink-0 flex-col">
      {/* Capped height so the lend panel below always keeps room on short laptop screens. */}
      <div className="relative aspect-video max-h-[24svh] overflow-hidden rounded-xl bg-navy-deep outline outline-1 -outline-offset-1 outline-white/10">
        {/* Mirrored like a mirror, which is how people expect to aim a card at a front camera. */}
        <video ref={videoRef} muted playsInline className={cn('size-full -scale-x-100 object-cover', scanner.status !== 'ready' && 'invisible')} />
        {scanner.status === 'ready' && (
          <div aria-hidden className="pointer-events-none absolute inset-y-[18%] left-1/2 aspect-square -translate-x-1/2 rounded-lg border-2 border-teal/80" />
        )}
        <p
          aria-live="polite"
          className={cn(
            'absolute inset-x-3 bottom-3 rounded-md bg-amber px-3 py-2 text-sm font-medium text-navy transition-[opacity,translate] duration-150 ease-out',
            scanner.multiple ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0',
          )}
        >
          {scanner.multiple ? t('camera.multiple') : ''}
        </p>
        {problem && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center">
            <CameraOff className="size-7 text-mist" aria-hidden />
            <p className="font-semibold">{t(problem[0])}</p>
            <p className="text-sm text-mist">{t(problem[1])}</p>
            <Button size="sm" variant="outline" onClick={scanner.retry} className="mt-1">
              <RotateCw aria-hidden />
              {t('camera.retry')}
            </Button>
          </div>
        )}
        {!scanner.multiple && (
          <span className="absolute top-2 left-2 flex items-center gap-2 rounded-full bg-navy-deep/80 px-2.5 py-1 text-xs text-mist" role="status">
            <span className={cn('size-2 rounded-full', scanner.status === 'ready' ? 'bg-teal' : scanner.status === 'starting' ? 'bg-amber' : 'bg-pink')} aria-hidden />
            {scanner.status === 'ready' ? t('camera.ready') : scanner.status === 'starting' ? t('camera.starting') : t(problem?.[0] ?? 'camera.error')}
          </span>
        )}
        {scanner.devices.length > 1 && (
          <Select value={scanner.deviceId ?? scanner.devices[0]?.deviceId} onValueChange={scanner.setDeviceId}>
            <SelectTrigger size="sm" className="absolute top-2 right-2 max-w-[50%] border-0 bg-navy-deep/80" aria-label={t('camera.choose')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scanner.devices.map((d, i) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `${t('camera.choose')} ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </section>
  )
}
