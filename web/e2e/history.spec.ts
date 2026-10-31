import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext } from '@playwright/test'

// All names are invented; real rosters never enter the repository.

let counter = 0

async function lentItem(request: APIRequestContext, person: string) {
  const label = `H${++counter}`
  const item = await (await request.post('/api/items', { data: { label } })).json()
  const res = await request.post('/api/borrowers', { data: { name: person } })
  const borrower = res.ok() ? await res.json() : (await (await request.get('/api/borrowers')).json()).find((b: { name: string }) => b.name === person)
  const loan = await (await request.post('/api/loans', { data: { item_id: item.id, borrower_id: borrower.id } })).json()
  return { item, loan }
}

async function patchSettings(request: APIRequestContext, patch: Record<string, unknown>) {
  const settings = await (await request.get('/api/settings')).json()
  const res = await request.put('/api/settings', { data: { ...settings, ...patch } })
  expect(res.ok()).toBeTruthy()
}

test('history lists loans and exports them as CSV', async ({ page, request }) => {
  const { item, loan } = await lentItem(request, 'Iga Historyczna')
  await request.post(`/api/loans/${loan.id}/return`)
  await page.goto('/')
  await page.getByRole('button', { name: 'History' }).click()

  const row = page.getByRole('row', { name: new RegExp(`${item.label} Iga Historyczna`) })
  await expect(row).toBeVisible()
  await page.getByRole('textbox', { name: /Search by name/ }).fill('iga')
  await expect(page.getByText(/^1 loans, 0 still out$/)).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const csv = readFileSync(await (await download).path(), 'utf8')
  expect(csv.startsWith('﻿Card,Student,Lent')).toBeTruthy()
  expect(csv).toContain(`${item.label},Iga Historyczna`)
  expect(csv).toContain('Returned')
})

test('a loan turns overdue once the time limit passes', async ({ page, request }) => {
  await patchSettings(request, { overdue_minutes: 60, closing_time: '' })
  const { item } = await lentItem(request, 'Jola Spóźniona')
  await page.clock.install()
  await page.goto('/')
  const seat = page.getByRole('button', { name: new RegExp(`Card ${item.label}, lent to Jola`) })
  await expect(seat).toBeVisible()

  await page.clock.fastForward('01:01:00')
  await expect(page.getByRole('button', { name: new RegExp(`Card ${item.label}, overdue, lent to Jola`) })).toBeVisible()
  await patchSettings(request, { overdue_minutes: 180 })
})

test('mark a lent card lost, then put it back in service', async ({ page, request }) => {
  const { item } = await lentItem(request, 'Kuba Zgubiony')
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(`Card ${item.label}, lent to Kuba`) }).click()
  await page.getByRole('button', { name: 'Mark lost' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Mark lost' }).click()
  await expect(page.getByRole('button', { name: `Card ${item.label}, lost` })).toBeVisible()

  await page.getByRole('button', { name: 'History' }).click()
  await expect(page.getByRole('row', { name: new RegExp(`${item.label} Kuba Zgubiony.*lost`) })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: `Card ${item.label}, lost` }).click()
  await page.getByRole('button', { name: 'Back in service' }).click()
  await expect(page.getByRole('button', { name: `Card ${item.label}, free` })).toBeVisible()
})

test('desk settings save and the backup downloads', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /& students/ }).click()
  await page.getByRole('tab', { name: 'Desk' }).click()
  await page.getByLabel('Time limit').fill('2.5')
  await page.getByLabel('Closing time').fill('19:30')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Desk settings saved')).toBeVisible()
  const settings = await (await request.get('/api/settings')).json()
  expect(settings.overdue_minutes).toBe(150)
  expect(settings.closing_time).toBe('19:30')

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download backup' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^item-tracker-.*\.db$/)
  expect(readFileSync(await file.path()).subarray(0, 15).toString()).toBe('SQLite format 3')
  await request.put('/api/settings', { data: { ...settings, overdue_minutes: 180, closing_time: '' } })
})
