import { expect, test } from '@playwright/test'

// All names are invented; real rosters never enter the repository.

async function openRoster(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /& students/ }).click()
  await page.getByRole('tab', { name: 'Roster' }).click()
}

test('paste a roster, remove someone, and they can no longer borrow', async ({ page, request }) => {
  const item = await (await request.post('/api/items', { data: { label: 'R1' } })).json()
  await page.goto('/')
  await openRoster(page)

  await page.getByRole('textbox', { name: 'Import students' }).fill('Celina Wymyślona\nDawid Zmyślony\n\nCelina Wymyślona\n')
  await expect(page.getByText('Names found: 3')).toBeVisible()
  await page.getByRole('button', { name: 'Import (3)' }).click()
  await expect(page.getByText(/Added 2, already there 0/)).toBeVisible()

  await page.getByRole('button', { name: 'Remove Dawid Zmyślony from the roster' }).click()
  await expect(page.getByText('Dawid Zmyślony removed from the roster')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: `Card ${item.label}, free` }).click()
  await page.getByPlaceholder('Type a name…').fill('dawid')
  await expect(page.getByText('No one on the roster matches “dawid”.')).toBeVisible()
  await page.getByPlaceholder('Type a name…').fill('celina')
  await expect(page.getByRole('option', { name: 'Celina Wymyślona' })).toBeVisible()
})

test('import a semicolon CSV with first and last name columns', async ({ page }) => {
  await page.goto('/')
  await openRoster(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Imię;Nazwisko;Grupa\nEwa;Fikcyjna;A\nFranek;Testowy;B\n'),
  })
  await expect(page.getByText('Names found: 2')).toBeVisible()
  await page.getByRole('button', { name: 'Import (2)' }).click()
  await expect(page.getByText(/Added 2/)).toBeVisible()
  await page.getByPlaceholder('Type a name…').last().fill('franek')
  await expect(page.getByText('Franek Testowy')).toBeVisible()
})

test('everyone on duty is recorded on each lend, up to five', async ({ page, request }) => {
  await request.post('/api/borrowers', { data: { name: 'Gosia Udawana' } })
  const item = await (await request.post('/api/items', { data: { label: 'R2' } })).json()
  const before = await (await request.get('/api/settings')).json()
  try {
    await page.goto('/')
    await page.getByRole('button', { name: 'Nobody on duty' }).click()
    const input = page.getByRole('textbox', { name: 'Add a volunteer on duty' })
    await input.fill('Hania Dyżurna')
    await page.keyboard.press('Enter')
    await input.fill('Igor Zmiana')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    const team = page.getByRole('group', { name: 'Volunteers on duty' })
    await expect(team.getByText('Hania Dyżurna')).toBeVisible()
    await expect(team.getByText('Igor Zmiana')).toBeVisible()

    await page.getByRole('button', { name: `Card ${item.label}, free` }).click()
    await page.getByPlaceholder('Type a name…').fill('gosia')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: new RegExp(`Card ${item.label}, lent to Gosia`) }).click()
    await expect(page.getByText('Handed out by Hania Dyżurna, Igor Zmiana')).toBeVisible()

    // Going off duty removes the chip; the server caps the team at five.
    await page.getByRole('button', { name: 'Take Igor Zmiana off duty' }).click()
    await expect(team.getByText('Igor Zmiana')).toBeHidden()
    const settings = await (await request.get('/api/settings')).json()
    const tooMany = await request.put('/api/settings', { data: { ...settings, volunteers: ['A', 'B', 'C', 'D', 'E', 'F'] } })
    expect(tooMany.status()).toBe(422)
  } finally {
    await request.put('/api/settings', { data: { ...before, volunteers: [] } })
  }
})
