import { useQueryClient } from '@tanstack/react-query'
import { Loader2, PlugZap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ActionPanel } from '@/components/desk/ActionPanel'
import { ActivityStrip } from '@/components/desk/ActivityStrip'
import { CameraPanel } from '@/components/desk/CameraPanel'
import { EmptyDesk } from '@/components/desk/EmptyDesk'
import { Header } from '@/components/desk/Header'
import { Legend, SeatGrid } from '@/components/desk/SeatGrid'
import { ManageSheet } from '@/components/manage/ManageSheet'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { stateKey, useDeskState, useNow } from '@/hooks/useDesk'
import { api, ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { I18nProvider } from '@/lib/I18nProvider'
import { formatDuration } from '@/lib/status'
import type { Borrower, DeskState, Item } from '@/lib/types'

export default function App() {
  const { data, error } = useDeskState()
  if (!data) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-8 text-center">
        {error ? (
          <>
            <PlugZap className="size-8 text-amber" aria-hidden />
            <h1 className="text-2xl font-semibold">Can’t reach the desk server</h1>
            <p className="max-w-[44ch] text-mist">Check that Docker Desktop is running; this page reconnects by itself.</p>
          </>
        ) : (
          <Loader2 className="size-8 animate-spin text-teal" aria-label="Loading" />
        )}
      </main>
    )
  }
  const { settings } = data
  return (
    <I18nProvider lang={settings.language} labels={settings.labels[settings.language]}>
      <TooltipProvider>
        <Desk state={data} />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </I18nProvider>
  )
}

declare global {
  interface Window {
    /** Lets end-to-end tests drive the scan path without a camera. */
    __itemTracker?: { scan: (code: string) => Promise<void> }
  }
}

function Desk({ state }: { state: DeskState }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const now = useNow()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [flash, setFlash] = useState<{ id: number; key: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const flashKey = useRef(0)

  const refresh = useCallback(() => client.invalidateQueries({ queryKey: stateKey }), [client])
  const selected = state.items.find((i) => i.id === selectedId) ?? null

  const flashSeat = useCallback((id: number) => setFlash({ id, key: ++flashKey.current }), [])

  const showError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.code === 'unknown_code') toast.error(t('toast.unknownCode'))
      else toast.error(err instanceof Error ? err.message : String(err))
    },
    [t],
  )

  const undo = useCallback(
    async (loanId: number) => {
      try {
        const loan = await api.undoReturn(loanId)
        toast.success(t('toast.undone', { label: loan.item_label, name: loan.borrower_name }))
        flashSeat(loan.item_id)
      } catch (err) {
        showError(err)
      }
      refresh()
    },
    [flashSeat, refresh, showError, t],
  )

  const announceReturn = useCallback(
    (loan: { id: number; item_id: number; item_label: string; borrower_name: string; lent_at: string; returned_at?: string }) => {
      const out = formatDuration(new Date(loan.returned_at ?? Date.now()).getTime() - new Date(loan.lent_at).getTime())
      flashSeat(loan.item_id)
      toast.success(t('toast.returned', { label: loan.item_label }), {
        description: t('toast.returnedBy', { name: loan.borrower_name, duration: out }),
        action: { label: t('toast.undo'), onClick: () => undo(loan.id) },
        duration: 12_000,
      })
    },
    [flashSeat, t, undo],
  )

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const res = await api.scan(code)
        if (res.action === 'returned') {
          // A return never interrupts a lend in progress for another item.
          if (selectedId === res.item.id) setSelectedId(null)
          announceReturn(res.loan)
        } else if (res.action === 'lend') {
          setSelectedId(res.item.id)
          flashSeat(res.item.id)
        } else {
          setSelectedId(res.item.id)
          toast.warning(t('toast.outOfService', { label: res.item.label, condition: t(`condition.${res.item.condition as 'lost' | 'damaged'}`) }))
        }
      } catch (err) {
        showError(err)
      }
      refresh()
    },
    [announceReturn, flashSeat, refresh, selectedId, showError, t],
  )

  useEffect(() => {
    window.__itemTracker = { scan: handleScan }
    return () => {
      delete window.__itemTracker
    }
  }, [handleScan])

  const lend = useCallback(
    async (item: Item, borrower: Borrower) => {
      setBusy(true)
      try {
        await api.lend(item.id, borrower.id)
        toast.success(t('toast.lent', { label: item.label, name: borrower.name }))
        flashSeat(item.id)
        setSelectedId(null)
      } catch (err) {
        showError(err)
      } finally {
        setBusy(false)
        refresh()
      }
    },
    [flashSeat, refresh, showError, t],
  )

  const takeBack = useCallback(
    async (item: Item) => {
      if (!item.loan) return
      setBusy(true)
      try {
        const loan = await api.returnLoan(item.loan.id)
        setSelectedId(null)
        announceReturn(loan)
      } catch (err) {
        showError(err)
      } finally {
        setBusy(false)
        refresh()
      }
    },
    [announceReturn, refresh, showError],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !manageOpen && setSelectedId(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [manageOpen])

  return (
    <div className="flex h-svh flex-col">
      <Header settings={state.settings} onManage={() => setManageOpen(true)} />
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_minmax(22rem,26rem)]">
        <main className="flex min-h-0 flex-col gap-4 p-6">
          {state.items.length === 0 ? (
            <EmptyDesk onManage={() => setManageOpen(true)} onChanged={refresh} />
          ) : (
            <>
              <Legend items={state.items} settings={state.settings} now={now} />
              <SeatGrid
                items={state.items}
                settings={state.settings}
                now={now}
                selectedId={selectedId}
                flash={flash}
                onSelect={(item) => setSelectedId(item.id === selectedId ? null : item.id)}
              />
            </>
          )}
        </main>
        <aside className="flex min-h-0 flex-col gap-6 border-l bg-navy-deep/40 p-6">
          <CameraPanel onCode={handleScan} />
          <ActionPanel
            item={selected}
            items={state.items}
            borrowers={state.borrowers}
            now={now}
            busy={busy}
            onLend={lend}
            onReturn={takeBack}
            onClose={() => setSelectedId(null)}
          />
        </aside>
      </div>
      <ActivityStrip recent={state.recent} />
      <ManageSheet open={manageOpen} onOpenChange={setManageOpen} state={state} onChanged={refresh} />
    </div>
  )
}
