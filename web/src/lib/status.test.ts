import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDuration, seatStatus } from './status.ts'
import type { Item, Settings } from './types.ts'

const settings = (over: Partial<Settings> = {}): Settings => ({
  labels: {} as Settings['labels'],
  language: 'en',
  branding: 'none',
  volunteers: [],
  overdue_minutes: 180,
  closing_time: '',
  ...over,
})

const lentItem = (lentAt: Date): Item => ({
  id: 1, label: '1', code: 'c', condition: 'ok', note: '',
  loan: { id: 1, item_id: 1, item_label: '1', borrower_id: 1, borrower_name: 'Ada', lent_at: lentAt.toISOString(), lent_by: '' },
})

test('free, out, due soon and overdue by duration', () => {
  const lent = new Date(2026, 10, 2, 9, 0)
  const at = (h: number, m: number) => new Date(2026, 10, 2, h, m)
  assert.equal(seatStatus({ ...lentItem(lent), loan: null }, settings(), at(9, 0)), 'free')
  assert.equal(seatStatus(lentItem(lent), settings(), at(11, 0)), 'out')
  assert.equal(seatStatus(lentItem(lent), settings(), at(11, 35)), 'due')
  assert.equal(seatStatus(lentItem(lent), settings(), at(12, 0)), 'overdue')
  assert.equal(seatStatus(lentItem(lent), settings({ overdue_minutes: 0 }), at(23, 0)), 'out')
})

test('closing time makes every open loan overdue', () => {
  const lent = new Date(2026, 10, 2, 18, 0)
  const s = settings({ overdue_minutes: 0, closing_time: '19:00' })
  assert.equal(seatStatus(lentItem(lent), s, new Date(2026, 10, 2, 18, 10)), 'out')
  assert.equal(seatStatus(lentItem(lent), s, new Date(2026, 10, 2, 18, 45)), 'due')
  assert.equal(seatStatus(lentItem(lent), s, new Date(2026, 10, 2, 19, 0)), 'overdue')
})

test('out of service wins over loans', () => {
  const item = { ...lentItem(new Date()), condition: 'lost' as const }
  assert.equal(seatStatus(item, settings(), new Date()), 'out_of_service')
})

test('formats durations', () => {
  assert.equal(formatDuration(20_000), '<1m')
  assert.equal(formatDuration(21 * 60_000), '21m')
  assert.equal(formatDuration((2 * 60 + 14) * 60_000), '2h 14m')
  assert.equal(formatDuration(3 * 3_600_000), '3h')
})
