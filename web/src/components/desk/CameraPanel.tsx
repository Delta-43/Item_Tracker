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
    <section aria-label={t('camera.preview')} className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-navy-deep">
        {/* Mirrored like a mirror, which is how people expect to aim a card at a front camera. */}
        <video ref={videoRef} muted playsInline className={cn('size-full -scale-x-100 object-cover', scanner.status !== 'ready' && 'invisible')} />
        {scanner.status === 'ready' && (
          <div aria-hidden className="pointer-events-none absolute inset-y-[18%] left-1/2 aspect-square -translate-x-1/2 rounded-lg border-2 border-teal/80" />
        )}
        {scanner.multiple && (
          <p className="absolute inset-x-3 bottom-3 rounded-md bg-amber px-3 py-2 text-sm font-medium text-navy">{t('camera.multiple')}</p>
        )}
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
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-2 text-mist" role="status">
          <span className={cn('size-2 rounded-full', scanner.status === 'ready' ? 'bg-teal' : scanner.status === 'starting' ? 'bg-amber' : 'bg-pink')} aria-hidden />
          {scanner.status === 'ready' ? t('camera.ready') : scanner.status === 'starting' ? t('camera.starting') : t(problem?.[0] ?? 'camera.error')}
        </span>
        {scanner.devices.length > 1 && (
          <Select value={scanner.deviceId ?? scanner.devices[0]?.deviceId} onValueChange={scanner.setDeviceId}>
            <SelectTrigger size="sm" className="ml-auto max-w-[55%]" aria-label={t('camera.choose')}>
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
