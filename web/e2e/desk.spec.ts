import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { cameraCode } from './fake-camera'

// All names are invented; real rosters never enter the repository.

let counter = 0

/** Creates an item with a unique label and code through the API. */
async function makeItem(request: APIRequestContext, code?: string) {
  const label = `T${++counter}`
  const res = await request.post('/api/items', { data: { label, code: code ?? `e2e:${label}:${Date.now()}` } })
  expect(res.ok()).toBeTruthy()
  return (await res.json()) as { id: number; label: string; code: string }
}

async function roster(request: APIRequestContext, names: string[]) {
  const res = await request.post('/api/borrowers/import', { data: { names } })
  expect(res.ok()).toBeTruthy()
}

/** Drives the same code path as a camera scan. */
async function scan(page: Page, code: string) {
  await page.evaluate((c) => window.__itemTracker!.scan(c), code)
}

test.beforeAll(async ({ request }) => {
  await roster(request, ['Ada Testowa', 'Bożena Przykład', 'Łukasz Próbny', 'Zoë Fikcyjna'])
})

test('camera scan lends a free card, the next scan returns it', async ({ page, request }) => {
  const item = await makeItem(request, cameraCode)
  await page.goto('/')
  await expect(page.getByText('Camera ready')).toBeVisible()

  // The fake camera shows the card's QR code every few seconds.
  await expect(page.getByRole('heading', { name: `Card ${item.label}` })).toBeVisible({ timeout: 15_000 })
  await page.getByPlaceholder('Type a name…').fill('ada')
  await page.keyboard.press('Enter')
  await expect(page.getByText(`Card ${item.label} lent to Ada Testowa`)).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(`Card ${item.label}, lent to Ada Testowa`) })).toBeVisible()

  await expect(page.getByText(`Card ${item.label} returned`)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: `Card ${item.label}, free` })).toBeVisible()
  // Stop the camera card from being scanned again by later tests.
  await request.patch(`/api/items/${item.id}`, { data: { code: `${cameraCode}:retired` } })
})

test('accent-insensitive search, one card per person, undo a return', async ({ page, request }) => {
  const first = await makeItem(request)
  const second = await makeItem(request)
  await page.goto('/')

  await page.getByRole('button', { name: `Card ${first.label}, free` }).click()
  await page.getByPlaceholder('Type a name…').fill('lukasz')
  await expect(page.getByRole('option', { name: 'Łukasz Próbny' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByText(`Card ${first.label} lent to Łukasz Próbny`)).toBeVisible()

  // Łukasz already holds a card, so he can't be picked for another one.
  await page.getByRole('button', { name: `Card ${second.label}, free` }).click()
  await page.getByPlaceholder('Type a name…').fill('próbny')
  await expect(page.getByRole('option', { name: /Łukasz Próbny/ })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText(`has card ${first.label}`)).toBeVisible()
  await page.keyboard.press('Escape')

  await scan(page, first.code)
  const toast = page.getByText(`Card ${first.label} returned`)
  await expect(toast).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText(`Return undone: card ${first.label} is with Łukasz Próbny again`)).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(`Card ${first.label}, lent to Łukasz Próbny`) })).toBeVisible()
})

test('take back by clicking, unknown codes and out-of-service cards', async ({ page, request }) => {
  const item = await makeItem(request)
  await page.goto('/')
  await page.getByRole('button', { name: `Card ${item.label}, free` }).click()
  await page.getByPlaceholder('Type a name…').fill('zoe')
  await page.getByRole('option', { name: 'Zoë Fikcyjna' }).click()
  await expect(page.getByText(`Card ${item.label} lent to Zoë Fikcyjna`)).toBeVisible()

  await page.getByRole('button', { name: new RegExp(`Card ${item.label}, lent to Zoë`) }).click()
  await page.getByRole('button', { name: `Take back card ${item.label}` }).click()
  await expect(page.getByText(`Card ${item.label} returned`)).toBeVisible()

  await scan(page, 'not-a-card')
  await expect(page.getByText('This QR code isn’t one of your cards')).toBeVisible()

  await request.patch(`/api/items/${item.id}`, { data: { condition: 'damaged' } })
  await scan(page, item.code)
  await expect(page.getByText(`Card ${item.label} is marked damaged`)).toBeVisible()
})

test('another tab sees changes live', async ({ page, request }) => {
  const item = await makeItem(request)
  await page.goto('/')
  await expect(page.getByRole('button', { name: `Card ${item.label}, free` })).toBeVisible()
  const people = (await (await request.get('/api/borrowers')).json()) as { id: number; name: string }[]
  const bozena = people.find((p) => p.name === 'Bożena Przykład')!
  await request.post('/api/loans', { data: { item_id: item.id, borrower_id: bozena.id } })
  await expect(page.getByRole('button', { name: new RegExp(`Card ${item.label}, lent to Bożena Przykład`) })).toBeVisible()
  await request.post(`/api/scan`, { data: { code: item.code } })
  await expect(page.getByRole('button', { name: `Card ${item.label}, free` })).toBeVisible()
})

test('cross-site requests are refused', async ({ request }) => {
  const res = await request.post('/api/items', { data: { label: 'evil' }, headers: { Origin: 'https://evil.example' } })
  expect(res.status()).toBe(403)
})

test('Enter does nothing until a borrower is chosen deliberately', async ({ page, request }) => {
  const item = await makeItem(request)
  await page.goto('/')
  await scan(page, item.code)
  await expect(page.getByRole('heading', { name: `Card ${item.label}` })).toBeVisible()
  // cmdk highlights the first roster row on its own; that must not arm the lend.
  await expect(page.getByRole('button', { name: `Lend card ${item.label}`, exact: true })).toBeDisabled()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  await expect(page.getByRole('button', { name: `Card ${item.label}, free` })).toBeVisible()

  // An arrow key is a deliberate pick: now Enter lends to the highlighted person.
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('button', { name: new RegExp(`^Lend card ${item.label} to `) })).toBeEnabled()
})
