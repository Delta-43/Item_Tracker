/** Quotes a cell when it contains the delimiter, quotes or line breaks. */
function cell(value: string, delimiter: string): string {
  return /["\r\n]/.test(value) || value.includes(delimiter) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Builds a CSV that opens correctly in Excel: a UTF-8 byte order mark so
 * Polish letters survive, and the delimiter the locale's Excel expects
 * (semicolon in Poland, comma elsewhere).
 */
export function toCsv(rows: string[][], delimiter: ',' | ';'): string {
  return '﻿' + rows.map((r) => r.map((v) => cell(v, delimiter)).join(delimiter)).join('\r\n') + '\r\n'
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
