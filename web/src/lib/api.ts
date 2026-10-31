import type { Borrower, DeskState, ImportResult, Item, Loan, ScanResult, Settings } from './types'

/** An error the server explained, with a stable code and a message for people. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    // A file goes up as it is; anything else is sent as JSON.
    const raw = body instanceof Blob
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': raw ? 'application/octet-stream' : 'application/json' },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'offline', 'Can’t reach the desk server. Is Docker running?')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'unknown', data?.message ?? `Request failed (${res.status})`)
  }
  return data as T
}

export const api = {
  state: () => request<DeskState>('GET', '/api/state'),
  scan: (code: string) => request<ScanResult>('POST', '/api/scan', { code }),

  lend: (itemId: number, borrowerId: number) =>
    request<Loan>('POST', '/api/loans', { item_id: itemId, borrower_id: borrowerId }),
  returnLoan: (loanId: number) => request<Loan>('POST', `/api/loans/${loanId}/return`),
  undoReturn: (loanId: number) => request<Loan>('POST', `/api/loans/${loanId}/undo-return`),
  loans: (params: Record<string, string> = {}) =>
    request<Loan[]>('GET', `/api/loans?${new URLSearchParams(params)}`),

  createItem: (label: string, code = '') => request<Item>('POST', '/api/items', { label, code }),
  updateItem: (id: number, patch: Partial<Pick<Item, 'label' | 'code' | 'condition' | 'note'>>) =>
    request<Item>('PATCH', `/api/items/${id}`, patch),
  deleteItem: (id: number) => request<void>('DELETE', `/api/items/${id}`),

  borrowers: (all = false) => request<Borrower[]>('GET', `/api/borrowers${all ? '?all=1' : ''}`),
  addBorrower: (name: string) => request<Borrower>('POST', '/api/borrowers', { name }),
  setBorrowerActive: (id: number, active: boolean) =>
    request<Borrower>('PATCH', `/api/borrowers/${id}`, { active }),
  importRoster: (names: string[], replace: boolean) =>
    request<ImportResult>('POST', '/api/borrowers/import', { names, replace }),

  saveSettings: (settings: Settings) => request<Settings>('PUT', '/api/settings', settings),
  restore: (backup: File) => request<{ saved: string }>('POST', '/api/restore', backup),
}
