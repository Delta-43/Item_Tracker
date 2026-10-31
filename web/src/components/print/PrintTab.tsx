import { Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/lib/i18n'
import type { Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import './print.css'

/** Stickers per A4 page with print.css's layout: 5 columns × 6 rows of 31.75 mm codes plus captions. */
const PER_PAGE = 30

/** SVG markup for each code, generated locally; the QR includes a 2-module quiet zone. */
function useQrSvgs(codes: string[]) {
  const [svgs, setSvgs] = useState<Record<string, string>>({})
  const key = codes.join('\n')
  useEffect(() => {
    let cancelled = false
    Promise.all(
      key.split('\n').filter(Boolean).map(async (c) => [c, await QRCode.toString(c, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })] as const),
    ).then((pairs) => !cancelled && setSvgs(Object.fromEntries(pairs)))
    return () => {
      cancelled = true
    }
  }, [key])
  return svgs
}

export function PrintTab({ items }: { items: Item[] }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<Set<number>>(() => new Set(items.map((i) => i.id)))
  const [copies, setCopies] = useState(1)
  const [captions, setCaptions] = useState(true)

  const chosen = items.filter((i) => selected.has(i.id))
  const stickers = useMemo(() => chosen.flatMap((i) => Array.from({ length: copies }, (_, n) => ({ item: i, key: `${i.id}-${n}` }))), [chosen, copies])
  const svgs = useQrSvgs(chosen.map((i) => i.code))
  const pages = Math.max(1, Math.ceil(stickers.length / PER_PAGE))

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-mist">{t('print.hint')}</p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="font-medium">{t('print.which')}</span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>
            {t('print.all')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            {t('print.none')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              aria-pressed={selected.has(i.id)}
              onClick={() => toggle(i.id)}
              className={cn(
                'min-w-11 rounded-md border-2 px-3 py-1.5 text-lg font-bold transition-colors',
                selected.has(i.id) ? 'border-teal bg-seat' : 'border-dashed border-line text-mist',
              )}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="copies">{t('print.copies')}</Label>
          <Input id="copies" type="number" min={1} max={10} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="captions" checked={captions} onCheckedChange={setCaptions} />
          <Label htmlFor="captions" className="font-normal">
            {t('print.captions')}
          </Label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={() => window.print()} disabled={stickers.length === 0}>
          <Printer aria-hidden />
          {t('print.button')}
        </Button>
        <span className="text-sm text-mist" role="status">
          {stickers.length === 0 ? t('print.empty') : t('print.summary', { count: stickers.length, pages })}
        </span>
      </div>

      {/* Preview at true size on screen; the same markup is what prints. */}
      <div className="rounded-lg bg-white p-4">
        <StickerGrid preview stickers={stickers.slice(0, 10)} svgs={svgs} captions={captions} />
      </div>

      {createPortal(
        <div className="print-sheet">
          <StickerGrid stickers={stickers} svgs={svgs} captions={captions} />
          <div className="print-ruler">
            <span className="print-ruler-line" />
            <span>{t('print.ruler')}</span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function StickerGrid({ stickers, svgs, captions, preview = false }: { stickers: { item: Item; key: string }[]; svgs: Record<string, string>; captions: boolean; preview?: boolean }) {
  const { t } = useI18n()
  return (
    <div className={cn('sticker-grid', preview && 'sticker-grid-preview')}>
      {stickers.map(({ item, key }) => (
        <figure key={key} className="sticker">
          {/* The SVG comes from the local QR encoder and contains only paths. */}
          <div className="sticker-code" dangerouslySetInnerHTML={{ __html: svgs[item.code] ?? '' }} />
          {captions && <figcaption>{t('panel.itemTitle', { label: item.label })}</figcaption>}
        </figure>
      ))}
    </div>
  )
}
