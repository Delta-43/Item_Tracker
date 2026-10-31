import { createContext, useContext } from 'react'
import type { Language } from './types'

// Placeholders: {item} "Card", {item_lc} "card", {items}, {items_lc},
// {borrower} "Student", {borrower_lc}, {borrowers}, {borrowers_lc}, plus
// per-message values such as {label} or {name}.
const en = {
  'app.loading': 'Opening the desk…',
  'app.offline': 'Can’t reach the desk server',
  'app.offlineHint': 'Check that Docker Desktop is running, then this page reconnects by itself.',
  'header.onDuty': 'On duty',
  'header.nobodyOnDuty': 'Nobody on duty',
  'header.manage': '{items} & {borrowers_lc}',
  'header.volunteerLabel': 'Volunteer on duty',
  'header.volunteerPlaceholder': 'Your name',

  'legend.free': '{count} free',
  'legend.out': '{count} out',
  'legend.due': '{count} due soon',
  'legend.overdue': '{count} overdue',
  'legend.outOfService': '{count} out of service',

  'seat.free': 'Free',
  'seat.since': 'since {time}',
  'seat.dueAt': 'due {time}',
  'seat.overdue': 'Overdue',
  'seat.lost': 'Lost',
  'seat.damaged': 'Damaged',
  'seat.aria.free': '{item} {label}, free',
  'seat.aria.out': '{item} {label}, lent to {name} for {duration}',
  'seat.aria.overdue': '{item} {label}, overdue, lent to {name} for {duration}',
  'seat.aria.outOfService': '{item} {label}, {condition}',

  'empty.title': 'No {items_lc} yet',
  'empty.body': 'Add the {items_lc} you lend out. Each one gets a QR code to print and stick on it.',
  'empty.quickAdd': 'Add {items_lc} 1 to {count}',
  'empty.manage': 'Set up {items_lc}',

  'camera.ready': 'Camera ready',
  'camera.starting': 'Starting camera…',
  'camera.denied': 'Camera access is blocked',
  'camera.deniedHint': 'Allow the camera in the browser’s address bar (and in Windows Settings › Privacy › Camera), then retry.',
  'camera.missing': 'No camera found',
  'camera.missingHint': 'Connect a webcam, then retry. You can still click a {item_lc} to lend or take it back.',
  'camera.busy': 'The camera is in use by another app',
  'camera.busyHint': 'Close Teams, Zoom or the Camera app, then retry.',
  'camera.error': 'The camera stopped working',
  'camera.retry': 'Retry',
  'camera.choose': 'Camera',
  'camera.multiple': 'More than one code in view. Show one {item_lc} at a time.',
  'camera.preview': 'Camera preview',

  'panel.idleTitle': 'Show a {item_lc} to the camera',
  'panel.idleBody': 'Out {items_lc} come back with one scan. Free ones ask who borrows them. You can also click a {item_lc} on the map.',
  'panel.itemTitle': '{item} {label}',
  'panel.free': 'Free · choose a {borrower_lc}',
  'panel.search': 'Type a name…',
  'panel.noMatch': 'No one on the roster matches “{query}”.',
  'panel.rosterEmpty': 'The roster is empty. Import {borrowers_lc} under {items} & {borrowers_lc} › Roster before lending.',
  'panel.hasItem': 'has {item_lc} {label}',
  'panel.lend': 'Lend {item_lc} {label}',
  'panel.lendTo': 'Lend {item_lc} {label} to {name}',
  'panel.cancel': 'Cancel',
  'panel.lentTo': 'Lent to',
  'panel.lentAt': 'Since {time} · {duration}',
  'panel.lentBy': 'Handed out by {name}',
  'panel.takeBack': 'Take back {item_lc} {label}',
  'panel.outOfService': 'This {item_lc} is marked {condition} and can’t be lent.',
  'panel.close': 'Close',

  'toast.lent': '{item} {label} lent to {name}',
  'toast.returned': '{item} {label} returned',
  'toast.returnedBy': '{name} · out {duration}',
  'toast.undo': 'Undo',
  'toast.undone': 'Return undone: {item_lc} {label} is with {name} again',
  'toast.outOfService': '{item} {label} is marked {condition}',
  'toast.unknownCode': 'This QR code isn’t one of your {items_lc}',

  'activity.title': 'Latest',
  'activity.lent': 'to',
  'activity.returned': 'back from',
  'activity.closed': 'marked {condition}, was with',
  'activity.none': 'Nothing lent yet today.',

  'manage.description': 'Set up what you lend and who can borrow it.',
  'items.title': '{items}',
  'items.description': 'Each {item_lc} needs a label and the value its QR code holds.',
  'items.addLabel': 'Label',
  'items.addCode': 'QR value',
  'items.addCodeHint': 'Leave empty to generate one',
  'items.add': 'Add {item_lc}',
  'items.edit': 'Edit',
  'items.save': 'Save',
  'items.delete': 'Delete',
  'items.deleteTitle': 'Delete {item_lc} {label}?',
  'items.deleteBody': 'This can’t be undone. {items} that have been lent can’t be deleted; mark them lost instead.',
  'items.out': 'with {name}',
  'items.count': '{count} {items_lc}',

  'roster.title': 'Roster',
  'roster.importTitle': 'Import {borrowers_lc}',
  'roster.importHint': 'Paste one name per line, or choose a CSV exported from Excel or Google Sheets with a name column (or first and last name columns). Only people on the roster can borrow.',
  'roster.placeholder': 'Ada Testowa\nBo Przykład\n…',
  'roster.chooseFile': 'Choose a file',
  'roster.found': '{count} names found',
  'roster.replace': 'Replace the roster',
  'roster.replaceHint': 'People missing from this list are removed, except anyone who still has a {item_lc}. Their history is kept.',
  'roster.import': 'Import {count} names',
  'roster.importNothing': 'Import',
  'roster.summary': 'Added {added}, already there {unchanged}, added back {reactivated}, removed {removed}.',
  'roster.kept': 'Kept because they still have a {item_lc}: {names}',
  'roster.invalid': 'Skipped (too long or empty): {names}',
  'roster.listTitle': 'On the roster ({count})',
  'roster.addPlaceholder': 'Add one person by name',
  'roster.add': 'Add',
  'roster.added': '{name} added to the roster',
  'roster.removed': '{name} removed from the roster',
  'roster.remove': 'Remove {name} from the roster',
  'roster.addBack': 'Add back',
  'roster.showRemoved': 'Show removed',
  'roster.empty': 'No one matches.',
  'roster.noneRemoved': 'No one has been removed.',

  'condition.lost': 'lost',
  'condition.damaged': 'damaged',
} as const

export type MessageKey = keyof typeof en
type Dictionary = Record<MessageKey, string>

export const dictionaries: Record<Language, Dictionary> = { en, pl: en }
export { en as english }

/** Registers a translation; PR-sized additions plug in without touching callers. */
export function registerDictionary(lang: Language, dict: Dictionary) {
  dictionaries[lang] = dict
}

export type Vars = Record<string, string | number>
export type Translate = (key: MessageKey, vars?: Vars) => string

export interface I18n {
  t: Translate
  lang: Language
  locale: string
}

export const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n outside I18nProvider')
  return ctx
}
