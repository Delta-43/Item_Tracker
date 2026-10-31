import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/lib/i18n'
import type { DeskState } from '@/lib/types'
import { ItemsTab } from './ItemsTab'
import { DeskTab } from './DeskTab'
import { RosterTab } from './RosterTab'

interface ManageSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: DeskState
  onChanged: () => void
}

/** Setup lives in a side drawer so the desk underneath stays visible and live. */
export function ManageSheet({ open, onOpenChange, state, onChanged }: ManageSheetProps) {
  const { t } = useI18n()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="text-xl">{t('header.manage')}</SheetTitle>
          <SheetDescription>{t('manage.description')}</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="items" className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsList>
            <TabsTrigger value="items">{t('items.title')}</TabsTrigger>
            <TabsTrigger value="roster">{t('roster.title')}</TabsTrigger>
            <TabsTrigger value="desk">{t('desk.title')}</TabsTrigger>
          </TabsList>
          <TabsContent value="items" className="pt-4">
            <ItemsTab items={state.items} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="roster" className="pt-4">
            <RosterTab borrowers={state.borrowers} items={state.items} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="desk" className="pt-4">
            <DeskTab key={`${state.settings.overdue_minutes}-${state.settings.closing_time}`} settings={state.settings} onChanged={onChanged} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
