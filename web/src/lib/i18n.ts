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
  'panel.rosterEmpty': 'The roster is empty. Add {borrowers_lc} before lending.',
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
