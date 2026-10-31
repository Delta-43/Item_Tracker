// Header names that mark a column, in English and Polish, compared after folding.
const fullNameHeaders = ['name', 'full name', 'fullname', 'student', 'imie i nazwisko', 'uczestnik']
const firstNameHeaders = ['first name', 'firstname', 'first_name', 'given name', 'imie']
const lastNameHeaders = ['last name', 'lastname', 'last_name', 'surname', 'family name', 'nazwisko']

function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .trim()
}

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      cells.push(cell)
      cell = ''
    } else cell += c
  }
  cells.push(cell)
  return cells.map((c) => c.trim())
}

/**
 * Turns pasted text or a CSV export into names. Accepts one name per line, or
 * a table with a "name" column or "first name" + "last name" columns (comma,
 * semicolon or tab separated, as Excel and Google Sheets export them).
 */
export function parseRoster(text: string): string[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return []
  const delimiter = ['\t', ';', ','].find((d) => lines[0].includes(d))
  if (!delimiter) return lines.map((l) => l.trim())

  const header = splitRow(lines[0], delimiter).map(fold)
  const full = header.findIndex((h) => fullNameHeaders.includes(h))
  const first = header.findIndex((h) => firstNameHeaders.includes(h))
  const last = header.findIndex((h) => lastNameHeaders.includes(h))
  const rows = lines.map((l) => splitRow(l, delimiter))

  if (full >= 0) return rows.slice(1).map((r) => r[full] ?? '').filter(Boolean)
  if (first >= 0 && last >= 0) {
    return rows
      .slice(1)
      .map((r) => `${r[first] ?? ''} ${r[last] ?? ''}`.trim())
      .filter(Boolean)
  }
  // No recognisable header: treat each row's cells as parts of one name.
  return rows.map((r) => r.filter(Boolean).join(' ')).filter(Boolean)
}
