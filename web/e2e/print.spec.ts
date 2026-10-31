import { expect, test } from '@playwright/test'

test('the print sheet holds true-size 1.25 in codes for the chosen cards', async ({ page, request }) => {
  const a = await (await request.post('/api/items', { data: { label: 'P1' } })).json()
  const b = await (await request.post('/api/items', { data: { label: 'P2' } })).json()
  await page.goto('/')
  await page.evaluate(() => {
    ;(window as unknown as { printed: number }).printed = 0
    window.print = () => {
      ;(window as unknown as { printed: number }).printed++
    }
  })
  await page.getByRole('button', { name: /& students/ }).click()
  await page.getByRole('tab', { name: 'Print' }).click()

  await page.getByRole('button', { name: 'None' }).click()
  await expect(page.getByText('Choose at least one card.')).toBeVisible()
  await page.getByRole('button', { name: a.label, exact: true }).click()
  await page.getByRole('button', { name: b.label, exact: true }).click()
  await page.getByLabel('Copies of each').fill('2')
  await expect(page.getByText('4 stickers on 1 A4 pages')).toBeVisible()

  await page.getByRole('button', { name: 'Print sheet' }).click()
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)

  await page.emulateMedia({ media: 'print' })
  const sheet = page.locator('.print-sheet')
  await expect(sheet).toBeVisible()
  await expect(page.locator('#root')).toBeHidden()
  await expect(sheet.locator('.sticker')).toHaveCount(4)
  await expect(sheet.locator('.sticker svg').first()).toBeVisible()
  // 31.75 mm is 120 CSS pixels at the CSS reference of 96 px per inch.
  const box = await sheet.locator('.sticker-code').first().boundingBox()
  expect(box!.width).toBeCloseTo(120, 0)
  expect(box!.height).toBeCloseTo(120, 0)
  await expect(sheet.getByText(`Card ${a.label}`).first()).toBeVisible()
})

test('switching the desk to Polish and renaming what it lends', async ({ page, request }) => {
  const before = await (await request.get('/api/settings')).json()
  const item = await (await request.post('/api/items', { data: { label: 'L1' } })).json()
  try {
    await page.goto('/')
    await page.getByRole('button', { name: /& students/ }).click()
    await page.getByRole('tab', { name: 'Desk' }).click()
    await page.getByLabel('Language').click()
    await page.getByRole('option', { name: 'Polski' }).click()
    // Captions stay in the saved language until the switch is saved; the field edits the Polish noun.
    await page.getByLabel('Item (one)').fill('Klucz')
    await page.getByRole('button', { name: 'Save language and wording' }).click()

    // The open drawer switches language at once.
    await expect(page.getByRole('tab', { name: 'Stanowisko' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Historia' })).toBeVisible()
    await expect(page.getByRole('button', { name: `Klucz ${item.label}, wolne` })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  } finally {
    await request.put('/api/settings', { data: before })
  }
})
