// Demo mode (VITE_DEMO=1): answers /api/* in the browser instead of the Go
// server, so the desk runs on GitHub Pages with nothing behind it. Data lives
// in this browser's localStorage and other tabs follow along live.
import { Desk, DeskError, type Snapshot } from './desk'
import { fixture, type Scenario } from './fixtures'

export const scenarios: Scenario[] = ['cards', 'keys', 'laptops']
const storeKey = (s: Scenario) => `itemtracker-demo:${s}`

function pickScenario(): Scenario {
  const fromUrl = new URLSearchParams(location.search).get('desk')
  if (scenarios.includes(fromUrl as Scenario)) return fromUrl as Scenario
  try {
    const saved = localStorage.getItem('itemtracker-demo:scenario')
    if (scenarios.includes(saved as Scenario)) return saved as Scenario
  } catch {
    // Storage blocked (private window): fall back to the first desk.
  }
  return 'cards'
}

function load(s: Scenario): Snapshot {
  try {
    const raw = localStorage.getItem(storeKey(s))
    if (raw) {
      const snap = JSON.parse(raw) as Snapshot
      if (snap.version === 1) return snap
    }
  } catch {
    // Unreadable or blocked storage: start from the fixture.
  }
  return fixture(s)
}

export const current = pickScenario()
const desk = new Desk(load(current))
const listeners = new Set<() => void>()
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('itemtracker-demo') : null

function changed() {
  try {
    localStorage.setItem(storeKey(current), JSON.stringify(desk.data))
    localStorage.setItem('itemtracker-demo:scenario', current)
  } catch {
    // The demo still works for this tab without storage.
  }
  channel?.postMessage(current)
  listeners.forEach((fn) => fn())
}

channel?.addEventListener('message', (e) => {
  if (e.data !== current) return
  desk.data = load(current)
  listeners.forEach((fn) => fn())
})

/** Puts the chosen desk back to its starting data. */
export function reset() {
  desk.data = fixture(current)
  changed()
}

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function route(method: string, url: URL, body: BodyInit | null | undefined): Promise<Response> {
  const path = url.pathname.slice(url.pathname.indexOf('/api/'))
  const data = typeof body === 'string' ? JSON.parse(body) : undefined
  const id = Number(path.split('/')[3])
  let result: unknown
  let mutates = true
  let status = 200
  switch (`${method} ${path.replace(/\/\d+(?=\/|$)/, '/:id')}`) {
    case 'GET /api/health':
      return json(200, { status: 'ok', version: 'demo' })
    case 'GET /api/state':
      mutates = false
      result = {
        settings: structuredClone(desk.data.settings),
        items: desk.items(),
        borrowers: desk.borrowers(false),
        recent: desk.recent(12),
        server_time: new Date().toISOString(),
      }
      break
    case 'POST /api/scan':
      result = desk.scan(data.code)
      mutates = (result as { action: string }).action === 'returned'
      break
    case 'GET /api/loans':
      mutates = false
      result = desk.loans(url.searchParams)
      break
    case 'POST /api/loans':
      result = desk.lend(data.item_id, data.borrower_id)
      status = 201
      break
    case 'POST /api/loans/:id/return':
      result = desk.returnLoan(id)
      break
    case 'POST /api/loans/:id/undo-return':
      result = desk.undoReturn(id)
      break
    case 'GET /api/borrowers':
      mutates = false
      result = desk.borrowers(url.searchParams.get('all') === '1')
      break
    case 'POST /api/borrowers':
      result = desk.addBorrower(data.name)
      status = 201
      break
    case 'POST /api/borrowers/import':
      result = desk.importRoster(data.names, data.replace)
      break
    case 'PATCH /api/borrowers/:id':
      result = desk.setBorrowerActive(id, data.active)
      break
    case 'POST /api/items':
      result = desk.createItem(data.label ?? '', data.code ?? '')
      status = 201
      break
    case 'PATCH /api/items/:id':
      result = desk.updateItem(id, data)
      break
    case 'DELETE /api/items/:id':
      desk.deleteItem(id)
      status = 204
      break
    case 'GET /api/settings':
      mutates = false
      result = structuredClone(desk.data.settings)
      break
    case 'PUT /api/settings':
      result = desk.saveSettings(data)
      break
    case 'POST /api/restore': {
      // A demo backup is the desk's data as JSON (see the backup link below).
      let snap: Snapshot | undefined
      try {
        snap = JSON.parse(await (body as Blob).text())
      } catch {
        // falls through to the refusal
      }
      if (snap?.version !== 1 || !Array.isArray(snap.items)) {
        throw new DeskError(422, 'not_a_backup', 'That file is not an Item Tracker backup')
      }
      desk.data = snap
      result = { saved: 'this browser (demo)' }
      break
    }
    default:
      return json(404, { error: 'not_found', message: 'Unknown API endpoint' })
  }
  if (mutates) changed()
  return json(status, result)
}

const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href)
  if (url.origin !== location.origin || !url.pathname.includes('/api/')) return realFetch(input, init)
  try {
    return await route((init?.method ?? 'GET').toUpperCase(), url, init?.body)
  } catch (err) {
    if (err instanceof DeskError) return json(err.status, { error: err.code, message: err.message })
    throw err
  }
}

/** Stands in for the server's event stream: "ready" once, then "change" after every edit. */
class DemoEventSource extends EventTarget {
  readonly readyState = 1
  private notify = () => this.dispatchEvent(new MessageEvent('change', { data: '{}' }))

  constructor() {
    super()
    listeners.add(this.notify)
    queueMicrotask(() => this.dispatchEvent(new MessageEvent('ready', { data: '{}' })))
  }

  close() {
    listeners.delete(this.notify)
  }
}
window.EventSource = DemoEventSource as unknown as typeof EventSource

// "Download backup" is a plain link to /api/backup; there is no server to
// answer it, so hand over the desk's data as a file instead.
document.addEventListener(
  'click',
  (e) => {
    const link = (e.target as Element | null)?.closest?.('a[href$="/api/backup"]')
    if (!link) return
    e.preventDefault()
    const file = new Blob([JSON.stringify(desk.data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = `item-tracker-demo-${current}.db`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  },
  true,
)
