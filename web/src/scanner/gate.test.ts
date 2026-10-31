import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PresentationGate } from './gate.ts'

/** Feeds frames every 100 ms like the camera loop and returns the actions taken. */
function run(g: PresentationGate, from: number, to: number, codes: string[]): string[] {
  const acted: string[] = []
  for (let t = from; t < to; t += 100) {
    const code = g.observe(codes, t)
    if (code) acted.push(`${code}@${t}`)
  }
  return acted
}

test('acts once while a code stays in view', () => {
  const g = new PresentationGate()
  assert.deepEqual(run(g, 0, 10_000, ['A']), ['A@0'])
})

test('acts again only after the code left the view long enough', () => {
  const g = new PresentationGate()
  run(g, 0, 500, ['A'])
  run(g, 500, 1800, []) // away 1.3 s
  assert.deepEqual(run(g, 1800, 2500, ['A']), [], 'too short an absence')
  run(g, 2500, 4200, []) // away 1.7 s
  assert.deepEqual(run(g, 4200, 5000, ['A']), ['A@4200'])
})

test('respects the cooldown even after a long enough absence', () => {
  const g = new PresentationGate(500, 3000)
  run(g, 0, 100, ['A'])
  run(g, 100, 800, [])
  assert.deepEqual(run(g, 800, 4000, ['A']), [], 'back within 3 s of acting, then held')
})

test('two codes in view act on neither', () => {
  const g = new PresentationGate()
  assert.deepEqual(run(g, 0, 1000, ['A', 'B']), [])
  assert.deepEqual(run(g, 1000, 1500, ['A']), [], 'A was part of the pair and never left')
  run(g, 1500, 3200, [])
  assert.deepEqual(run(g, 3200, 3500, ['B']), ['B@3200'])
})

test('a different code acts immediately', () => {
  const g = new PresentationGate()
  assert.deepEqual(run(g, 0, 300, ['A']), ['A@0'])
  assert.deepEqual(run(g, 300, 600, ['B']), ['B@300'])
})
