import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toCsv } from './csv.ts'

test('quotes only cells that need it and starts with a BOM', () => {
  const csv = toCsv([['Card', 'Borrower'], ['1', 'Testowa, Ada'], ['2', 'Bo "B" Przykład']], ',')
  assert.equal(csv, '﻿Card,Borrower\r\n1,"Testowa, Ada"\r\n2,"Bo ""B"" Przykład"\r\n')
})

test('semicolon delimiter for Polish Excel', () => {
  assert.equal(toCsv([['a;b', 'c,d']], ';'), '﻿"a;b";c,d\r\n')
})
