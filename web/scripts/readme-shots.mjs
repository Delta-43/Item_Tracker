// Builds three invented desks (access cards, workshop keys, laptops in Polish)
// on scratch servers and captures the README screenshots into docs/images/.
// Build first: `npm run build` in web/, then `go build -o bin/itemtracker ./cmd/itemtracker`.
// Usage (from web/): node scripts/readme-shots.mjs
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import QRCode from 'qrcode'

const repo = resolve(import.meta.dirname, '../..')
const out = process.argv[2] ?? join(repo, 'docs/images')
const scratch = mkdtempSync(join(tmpdir(), 'readme-shots-'))

// --- fake camera: a light desk surface, optionally with a QR sticker held up ---
function writeCamera(path, code) {
  const width = 320, height = 240, fps = 10
  const blank = Buffer.alloc(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    blank[y * width + x] = 150 + Math.round(40 * (1 - Math.hypot(x - 160, y - 120) / 200))
  }
  const frame = Buffer.from(blank)
  if (code) {
    const qr = QRCode.create(code, { errorCorrectionLevel: 'M' })
    const size = qr.modules.size, scale = Math.floor(150 / (size + 8)), side = (size + 8) * scale
    const left = Math.floor((width - side) / 2), top = Math.floor((height - side) / 2)
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const mx = Math.floor(x / scale) - 4, my = Math.floor(y / scale) - 4
      const dark = mx >= 0 && my >= 0 && mx < size && my < size && qr.modules.get(my, mx) === 1
      frame[(top + y) * width + left + x] = dark ? 0x14 : 0xf4
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128)
  const parts = [Buffer.from(`YUV4MPEG2 W${width} H${height} F${fps}:1 Ip A1:1 C420jpeg\n`)]
  for (let i = 0; i < 20; i++) parts.push(Buffer.from('FRAME\n'), frame, chroma)
  writeFileSync(path, Buffer.concat(parts))
}

// --- a scratch desk server ---
let nextPort = 4361
async function startDesk() {
  const port = nextPort++
  const data = join(scratch, `data-${port}`)
  const proc = spawn(join(repo, 'bin/itemtracker'), [], {
    env: { ...process.env, ITEMTRACKER_ADDR: `127.0.0.1:${port}`, ITEMTRACKER_DATA: data }, stdio: 'ignore',
  })
  const base = `http://localhost:${port}`
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + '/api/health')).ok) break } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
    return res.status === 204 ? null : res.json()
  }
  return { base, call, db: join(data, 'item-tracker.db'), stop: () => proc.kill() }
}

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString().replace(/\.\d+Z$/, '.000Z')

/** Seeds a desk. loans: [itemIndex, person, minutesAgo, returnedMinutesAgo?] */
async function seed(desk, { settings, items, people, loans, condition, team }) {
  const st = await desk.call('GET', '/api/settings')
  await desk.call('PUT', '/api/settings', { ...st, ...settings, volunteers: team })
  const made = []
  for (const [label, code] of items) made.push(await desk.call('POST', '/api/items', { label, code }))
  await desk.call('POST', '/api/borrowers/import', { names: people })
  const ids = Object.fromEntries((await desk.call('GET', '/api/borrowers')).map((b) => [b.name, b.id]))
  const times = []
  // Oldest first, so "Latest" reads in order.
  for (const [i, person, ago, back] of [...loans].sort((a, b) => b[2] - a[2])) {
    const loan = await desk.call('POST', '/api/loans', { item_id: made[i].id, borrower_id: ids[person] })
    if (back !== undefined) await desk.call('POST', `/api/loans/${loan.id}/return`)
    times.push([loan.id, ago, back])
  }
  for (const [i, cond, note] of condition ?? []) await desk.call('PATCH', `/api/items/${made[i].id}`, { condition: cond, note })
  const db = new DatabaseSync(desk.db)
  for (const [id, ago, back] of times) {
    db.prepare('UPDATE loans SET lent_at = ? WHERE id = ?').run(iso(ago), id)
    if (back !== undefined) db.prepare('UPDATE loans SET returned_at = ? WHERE id = ?').run(iso(back), id)
  }
  db.close()
  return made
}

async function browserWith(code) {
  const video = join(scratch, `cam-${code ?? 'blank'}.y4m`.replace(/[^\w.-]/g, '_'))
  writeCamera(video, code)
  return chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
  })
}

async function open(browser, base, ready = 'Camera ready', size = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: size, permissions: ['camera'], reducedMotion: 'reduce', deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('page error:', e.message))
  await p.goto(base)
  await p.getByText(ready).first().waitFor()
  await p.waitForTimeout(600)
  return p
}
const shot = (p, name) => p.screenshot({ path: join(out, `${name}.png`) })

// Invented people only; real rosters never enter the repository.
const students = ['Anna Kowalska', 'Jan Nowak', 'Zofia Wiśniewska', 'Mateusz Lewandowski', 'Ola Wójcik', 'Marta Kamińska',
  'Marek Dąbrowski', 'Maria Szymańska', 'Tomasz Wróbel', 'Paweł Kaczmarek', 'Łucja Zielińska', 'Ümit Demir',
  'Lena Fischer', 'Diego Ramírez', 'Mariana Costa', 'Oksana Melnyk']

// ---------- 1. Access cards (English, 42 Warsaw logo) ----------
{
  const desk = await startDesk()
  await seed(desk, {
    settings: { language: 'en', branding: '42warsaw', overdue_minutes: 180 },
    team: ['Kasia M.', 'Piotr W.'],
    items: Array.from({ length: 10 }, (_, n) => [String(n + 1), `carddesk:${n + 1}`]),
    people: students,
    loans: [[1, 'Anna Kowalska', 134], [3, 'Jan Nowak', 159], [4, 'Mateusz Lewandowski', 21], [6, 'Zofia Wiśniewska', 399],
      [9, 'Ola Wójcik', 17], [0, 'Tomasz Wróbel', 50, 19], [2, 'Lena Fischer', 260, 200], [7, 'Diego Ramírez', 300, 120]],
    condition: [[8, 'damaged', 'Cracked corner']],
  })

  const plain = await browserWith(null)
  const p = await open(plain, desk.base)
  await shot(p, 'cards-desk')
  await p.getByRole('button', { name: /Card 7, overdue/ }).click()
  await p.waitForTimeout(300)
  await shot(p, 'cards-loan')
  await p.keyboard.press('Escape')
  await p.getByRole('button', { name: 'History' }).click()
  await p.getByRole('tab', { name: 'All' }).click()
  await p.waitForTimeout(400)
  await shot(p, 'cards-history')
  await p.keyboard.press('Escape')
  for (const tab of ['Cards', 'Roster', 'Print', 'Desk']) {
    await p.getByRole('button', { name: /& students/ }).click()
    await p.getByRole('tab', { name: tab }).click()
    await p.waitForTimeout(400)
    if (tab === 'Desk') await p.getByRole('button', { name: 'Restore from backup' }).scrollIntoViewIfNeeded()
    await shot(p, `cards-manage-${tab.toLowerCase()}`)
    await p.keyboard.press('Escape')
    await p.waitForTimeout(200)
  }
  await plain.close()

  // A volunteer holds card 3 up to the camera: the desk asks who borrows it.
  const scanning = await browserWith('carddesk:3')
  const q = await open(scanning, desk.base, /Lend|Who/i)
  await q.keyboard.type('mar')
  await q.waitForTimeout(400)
  await shot(q, 'cards-scan-lend')
  await scanning.close()
  desk.stop()
}

// ---------- 2. Workshop keys (English, no logo) ----------
{
  const desk = await startDesk()
  await seed(desk, {
    settings: {
      language: 'en', branding: 'none', overdue_minutes: 120, closing_time: '20:00',
      labels: {
        en: { item: 'Key', items: 'Keys', borrower: 'Member', borrowers: 'Members', desk: 'Makerspace key desk' },
        pl: { item: 'Klucz', items: 'Klucze', borrower: 'Członek', borrowers: 'Członkowie', desk: 'Klucze pracowni' },
      },
    },
    team: ['Robin K.'],
    items: [['Wood', 'key:wood'], ['Metal', 'key:metal'], ['Laser', 'key:laser'], ['3D', 'key:3d'], ['Paint', 'key:paint'],
      ['Storeroom', 'key:store'], ['Roof', 'key:roof'], ['Van', 'key:van']],
    people: ['Sam Okafor', 'Ingrid Berg', 'Tariq Haddad', 'Mei Lin', 'Jonas Weber', 'Priya Nair', 'Hugo Martin', 'Ada Novak'],
    loans: [[0, 'Sam Okafor', 45], [2, 'Mei Lin', 100], [5, 'Jonas Weber', 160], [7, 'Priya Nair', 12], [1, 'Hugo Martin', 90, 30]],
    condition: [[6, 'lost', 'Not returned after the open day']],
  })
  const b = await browserWith(null)
  const p = await open(b, desk.base)
  await shot(p, 'keys-desk')
  await b.close()
  desk.stop()
}

// ---------- 3. Laptops (Polish interface, no logo) ----------
{
  const desk = await startDesk()
  await seed(desk, {
    settings: {
      language: 'pl', branding: 'none', overdue_minutes: 90,
      labels: {
        en: { item: 'Laptop', items: 'Laptops', borrower: 'Pupil', borrowers: 'Pupils', desk: 'Laptop trolley' },
        pl: { item: 'Laptop', items: 'Laptopy', borrower: 'Uczeń', borrowers: 'Uczniowie', desk: 'Wypożyczalnia laptopów' },
      },
    },
    team: ['p. Nowicka', 'Kuba'],
    items: Array.from({ length: 12 }, (_, n) => [`L${String(n + 1).padStart(2, '0')}`, `laptop:${n + 1}`]),
    people: students,
    loans: [[0, 'Marta Kamińska', 30], [1, 'Paweł Kaczmarek', 70], [2, 'Łucja Zielińska', 95], [4, 'Marek Dąbrowski', 15],
      [5, 'Maria Szymańska', 40], [8, 'Oksana Melnyk', 55], [10, 'Mariana Costa', 5], [3, 'Ümit Demir', 120, 60]],
    condition: [[11, 'damaged', 'Pęknięty zawias']],
  })
  const b = await browserWith(null)
  const p = await open(b, desk.base, 'Kamera gotowa')
  await shot(p, 'laptops-desk-pl')
  await b.close()
  desk.stop()
}
console.log('done')
