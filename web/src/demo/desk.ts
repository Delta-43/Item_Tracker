// An in-browser copy of the desk server for the GitHub Pages demo. It follows
// the same rules as internal/store (one open loan per item and per person,
// roster only, out-of-service items can't be lent) and answers the same API.
import { foldName } from '@/lib/names'
import type { Activity, Borrower, ImportResult, Item, Loan, Settings } from '@/lib/types'

interface StoredItem {
  id: number
  label: string
  code: string
  condition: Item['condition']
  note: string
}

interface StoredLoan {
  id: number
  item_id: number
  borrower_id: number
  lent_at: string
  lent_by: string
  returned_at?: string
  returned_by?: string
  close_reason?: 'returned' | 'lost' | 'damaged'
}

export interface Snapshot {
  version: 1
  settings: Settings
  items: StoredItem[]
  borrowers: Borrower[]
  loans: StoredLoan[]
  next: number
}

export class DeskError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function newCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return 'item:' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export class Desk {
  data: Snapshot

  constructor(data: Snapshot) {
    this.data = data
  }

  private now = () => new Date().toISOString()
  private id = () => this.data.next++

  private volunteer = () => this.data.settings.volunteers.join(', ')

  private borrower(id: number): Borrower {
    const b = this.data.borrowers.find((x) => x.id === id)
    if (!b) throw new DeskError(404, 'borrower_not_found', 'That borrower no longer exists')
    return b
  }

  private storedItem(id: number): StoredItem {
    const it = this.data.items.find((x) => x.id === id)
    if (!it) throw new DeskError(404, 'item_not_found', 'That item no longer exists')
    return it
  }

  private loanView(l: StoredLoan): Loan {
    return {
      ...l,
      item_label: this.storedItem(l.item_id).label,
      borrower_name: this.borrower(l.borrower_id).name,
    }
  }

  private openLoan(where: (l: StoredLoan) => boolean) {
    return this.data.loans.find((l) => !l.returned_at && where(l))
  }

  private itemView(it: StoredItem): Item {
    const open = this.openLoan((l) => l.item_id === it.id)
    return { ...it, loan: open ? this.loanView(open) : null }
  }

  items(): Item[] {
    return this.data.items.map((it) => this.itemView(it)).sort((a, b) => naturalCompare(a.label, b.label))
  }

  borrowers(all: boolean): Borrower[] {
    return this.data.borrowers
      .filter((b) => all || b.active)
      .map((b) => ({ ...b }))
      .sort((a, b) => (foldName(a.name) < foldName(b.name) ? -1 : 1))
  }

  recent(limit: number): Activity[] {
    const events: Activity[] = []
    for (const l of this.data.loans) {
      events.push({ kind: 'lent', at: l.lent_at, loan: this.loanView(l) })
      if (l.returned_at) events.push({ kind: l.close_reason ?? 'returned', at: l.returned_at, loan: this.loanView(l) })
    }
    return events.sort((a, b) => (a.at === b.at ? b.loan.id - a.loan.id : a.at < b.at ? 1 : -1)).slice(0, limit)
  }

  loans(q: URLSearchParams): Loan[] {
    const from = q.get('from'), to = q.get('to')
    const itemId = Number(q.get('item_id') ?? 0), borrowerId = Number(q.get('borrower_id') ?? 0)
    const limit = Number(q.get('limit') ?? 0) || 10000
    return this.data.loans
      .filter((l) => (!from || l.lent_at >= new Date(from).toISOString()) && (!to || l.lent_at < new Date(to).toISOString()))
      .filter((l) => (!itemId || l.item_id === itemId) && (!borrowerId || l.borrower_id === borrowerId))
      .filter((l) => q.get('open') !== '1' || !l.returned_at)
      .sort((a, b) => (a.lent_at === b.lent_at ? b.id - a.id : a.lent_at < b.lent_at ? 1 : -1))
      .slice(0, limit)
      .map((l) => this.loanView(l))
  }

  lend(itemId: number, borrowerId: number): Loan {
    const it = this.itemView(this.storedItem(itemId))
    if (it.condition !== 'ok') throw new DeskError(409, 'item_out_of_service', `${it.label} is marked ${it.condition} and can't be lent`)
    if (it.loan) throw new DeskError(409, 'item_busy', `${it.label} is already lent to ${it.loan.borrower_name}`)
    const b = this.borrower(borrowerId)
    if (!b.active) throw new DeskError(409, 'not_on_roster', `${b.name} is not on the roster`)
    const held = this.openLoan((l) => l.borrower_id === borrowerId)
    if (held) throw new DeskError(409, 'borrower_has_item', `${b.name} already has ${this.storedItem(held.item_id).label}; take it back first`)
    const loan: StoredLoan = { id: this.id(), item_id: itemId, borrower_id: borrowerId, lent_at: this.now(), lent_by: this.volunteer() }
    this.data.loans.push(loan)
    return this.loanView(loan)
  }

  private loan(id: number): StoredLoan {
    const l = this.data.loans.find((x) => x.id === id)
    if (!l) throw new DeskError(404, 'loan_not_found', 'That loan no longer exists')
    return l
  }

  returnLoan(id: number): Loan {
    const l = this.loan(id)
    if (l.returned_at) throw new DeskError(409, 'already_returned', 'That item was already returned')
    Object.assign(l, { returned_at: this.now(), returned_by: this.volunteer(), close_reason: 'returned' })
    return this.loanView(l)
  }

  undoReturn(id: number): Loan {
    const l = this.loan(id)
    if (!l.returned_at || l.close_reason !== 'returned') throw new DeskError(409, 'cannot_undo', 'Only a return can be undone')
    if (this.openLoan((o) => o.item_id === l.item_id || o.borrower_id === l.borrower_id)) {
      const v = this.loanView(l)
      throw new DeskError(409, 'cannot_undo', `${v.item_label} or ${v.borrower_name} has a newer loan, so this return can't be undone`)
    }
    delete l.returned_at
    delete l.returned_by
    delete l.close_reason
    return this.loanView(l)
  }

  scan(code: string) {
    const stored = this.data.items.find((it) => it.code === code.trim())
    if (!stored) throw new DeskError(404, 'unknown_code', "This QR code doesn't belong to any item")
    const it = this.itemView(stored)
    if (it.loan) {
      const loan = this.returnLoan(it.loan.id)
      return { action: 'returned', item: { ...it, loan: null }, loan }
    }
    return { action: it.condition === 'ok' ? 'lend' : 'out_of_service', item: it }
  }

  private checkItem(label: string, code: string, self?: number) {
    if (!label) throw new DeskError(422, 'invalid_label', 'Give the item a label')
    if ([...label].length > 40) throw new DeskError(422, 'invalid_label', 'Labels can be at most 40 characters')
    if (!code) throw new DeskError(422, 'invalid_code', "The QR value can't be empty")
    const others = this.data.items.filter((it) => it.id !== self)
    if (others.some((it) => it.code === code)) throw new DeskError(409, 'code_taken', 'Another item already uses that QR value')
    if (others.some((it) => it.label.toLowerCase() === label.toLowerCase())) throw new DeskError(409, 'label_taken', 'Another item already has that label')
  }

  createItem(label: string, code: string): Item {
    label = clean(label)
    code = code.trim() || newCode()
    this.checkItem(label, code)
    const it: StoredItem = { id: this.id(), label, code, condition: 'ok', note: '' }
    this.data.items.push(it)
    return this.itemView(it)
  }

  updateItem(id: number, p: Partial<Pick<StoredItem, 'label' | 'code' | 'condition' | 'note'>>): Item {
    const it = this.storedItem(id)
    const next = {
      label: p.label !== undefined ? clean(p.label) : it.label,
      code: p.code !== undefined ? p.code.trim() : it.code,
      condition: p.condition ?? it.condition,
      note: p.note !== undefined ? p.note.trim() : it.note,
    }
    if (!['ok', 'lost', 'damaged'].includes(next.condition)) throw new DeskError(422, 'invalid_condition', 'Unknown condition')
    this.checkItem(next.label, next.code, id)
    const open = this.openLoan((l) => l.item_id === id)
    Object.assign(it, next)
    if (open && next.condition !== 'ok') {
      Object.assign(open, { returned_at: this.now(), returned_by: this.volunteer(), close_reason: next.condition })
    }
    return this.itemView(it)
  }

  deleteItem(id: number) {
    this.storedItem(id)
    if (this.data.loans.some((l) => l.item_id === id)) {
      throw new DeskError(409, 'has_history', 'This item has loan history; mark it lost or damaged instead of deleting it')
    }
    this.data.items = this.data.items.filter((it) => it.id !== id)
  }

  private findPerson(name: string) {
    const key = foldName(name)
    return this.data.borrowers.find((b) => foldName(b.name) === key)
  }

  private cleanName(raw: string): string {
    const name = clean(raw).normalize('NFC')
    if (!name) throw new DeskError(422, 'invalid_name', 'Enter a name')
    if ([...name].length > 120) throw new DeskError(422, 'invalid_name', 'Names can be at most 120 characters')
    return name
  }

  addBorrower(raw: string): Borrower {
    const name = this.cleanName(raw)
    const known = this.findPerson(name)
    if (known?.active) throw new DeskError(409, 'already_on_roster', `${known.name} is already on the roster`)
    if (known) return Object.assign(known, { name, active: true })
    const b = { id: this.id(), name, active: true }
    this.data.borrowers.push(b)
    return { ...b }
  }

  setBorrowerActive(id: number, active: boolean): Borrower {
    const b = this.borrower(id)
    if (!active && this.openLoan((l) => l.borrower_id === id)) {
      throw new DeskError(409, 'borrower_has_item', `${b.name} still has an item; take it back first`)
    }
    b.active = active
    return { ...b }
  }

  importRoster(names: string[], replace: boolean): ImportResult {
    const res: ImportResult = { added: 0, reactivated: 0, unchanged: 0, deactivated: 0, kept_active: [], invalid: [] }
    const seen = new Set<string>()
    for (const raw of names) {
      let name: string
      try {
        name = this.cleanName(raw)
      } catch {
        if (raw.trim()) res.invalid.push(raw)
        continue
      }
      const key = foldName(name)
      if (seen.has(key)) continue
      seen.add(key)
      const known = this.findPerson(name)
      if (!known) {
        this.data.borrowers.push({ id: this.id(), name, active: true })
        res.added++
      } else if (known.active) {
        res.unchanged++
      } else {
        Object.assign(known, { name, active: true })
        res.reactivated++
      }
    }
    if (replace) {
      for (const b of this.data.borrowers) {
        if (!b.active || seen.has(foldName(b.name))) continue
        if (this.openLoan((l) => l.borrower_id === b.id)) res.kept_active.push(b.name)
        else {
          b.active = false
          res.deactivated++
        }
      }
    }
    return res
  }

  saveSettings(st: Settings): Settings {
    const volunteers: string[] = []
    for (const v of st.volunteers.map(clean)) {
      if (v && !volunteers.some((x) => foldName(x) === foldName(v))) volunteers.push(v)
    }
    if (volunteers.length > 5) throw new DeskError(422, 'too_many_volunteers', 'Up to 5 people can be on duty at once')
    if (st.closing_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(st.closing_time)) {
      throw new DeskError(422, 'invalid_closing_time', 'Closing time must look like 18:30')
    }
    if (st.overdue_minutes < 0 || st.overdue_minutes > 7 * 24 * 60) {
      throw new DeskError(422, 'invalid_overdue', 'The overdue limit must be between 0 minutes and 7 days')
    }
    for (const l of Object.values(st.labels)) {
      for (const v of Object.values(l)) {
        if (!clean(v) || [...v].length > 40) throw new DeskError(422, 'invalid_labels', 'Every label needs 1 to 40 characters')
      }
    }
    this.data.settings = { ...st, volunteers }
    return structuredClone(this.data.settings)
  }
}
