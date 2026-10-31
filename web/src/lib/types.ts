// Mirrors the Go API (internal/store, internal/server).

export type Condition = 'ok' | 'lost' | 'damaged'

export interface Loan {
  id: number
  item_id: number
  item_label: string
  borrower_id: number
  borrower_name: string
  lent_at: string
  lent_by: string
  returned_at?: string
  returned_by?: string
  close_reason?: 'returned' | 'lost' | 'damaged'
}

export interface Item {
  id: number
  label: string
  code: string
  condition: Condition
  note: string
  loan: Loan | null
}

export interface Borrower {
  id: number
  name: string
  active: boolean
}

export interface Labels {
  item: string
  items: string
  borrower: string
  borrowers: string
  desk: string
}

export type Language = 'en' | 'pl'

export interface Settings {
  labels: Record<Language, Labels>
  language: Language
  branding: '42warsaw' | 'none'
  volunteer: string
  overdue_minutes: number
  closing_time: string
}

export interface Activity {
  kind: 'lent' | 'returned' | 'lost' | 'damaged'
  at: string
  loan: Loan
}

export interface DeskState {
  settings: Settings
  items: Item[]
  borrowers: Borrower[]
  recent: Activity[]
  server_time: string
}

export type ScanResult =
  | { action: 'returned'; item: Item; loan: Loan }
  | { action: 'lend'; item: Item }
  | { action: 'out_of_service'; item: Item }

export interface ImportResult {
  added: number
  reactivated: number
  unchanged: number
  deactivated: number
  kept_active: string[]
  invalid: string[]
}
