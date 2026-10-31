import assert from 'node:assert/strict'
import { test } from 'node:test'
import { foldName, nameMatches } from './names.ts'

test('folds Polish and Turkish letters like the server', () => {
  assert.equal(foldName('Łukasz  Wójcik'), 'lukasz wojcik')
  assert.equal(foldName('Ümmü Güzeliş'), 'ummu guzelis')
  assert.equal(foldName('Małgorzata Żak'), 'malgorzata zak')
})

test('matches word prefixes in any order', () => {
  assert.ok(nameMatches('Marta Kamińska', 'kam'))
  assert.ok(nameMatches('Marta Kamińska', 'ma ka'))
  assert.ok(nameMatches('Marta Kamińska', 'kaminska marta'))
  assert.ok(!nameMatches('Marta Kamińska', 'arta'))
  assert.ok(nameMatches('Anyone', ''))
})
