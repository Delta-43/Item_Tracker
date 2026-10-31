import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRoster } from './roster.ts'

// Invented names only.

test('one name per line, blank lines and spacing ignored', () => {
  assert.deepEqual(parseRoster('Ada Testowa\n\n  Bo Przykład  \r\nZoë Fikcyjna\n'), ['Ada Testowa', 'Bo Przykład', 'Zoë Fikcyjna'])
})

test('a name column in a comma CSV with quotes and a BOM', () => {
  const csv = '﻿id,Name,group\n1,"Testowa, Ada",A\n2,Bo Przykład,B\n'
  assert.deepEqual(parseRoster(csv), ['Testowa, Ada', 'Bo Przykład'])
})

test('first and last name columns, semicolon separated (Polish Excel)', () => {
  const csv = 'Imię;Nazwisko;Email\nAda;Testowa;a@example.com\nŁucja;Próbna;l@example.com\n'
  assert.deepEqual(parseRoster(csv), ['Ada Testowa', 'Łucja Próbna'])
})

test('tab separated without a header joins the cells', () => {
  assert.deepEqual(parseRoster('Ada\tTestowa\nBo\tPrzykład'), ['Ada Testowa', 'Bo Przykład'])
})

test('empty input', () => {
  assert.deepEqual(parseRoster(' \n \n'), [])
})
