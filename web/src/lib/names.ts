// Letters that are their own base character rather than base + accent, so
// NFD decomposition alone would not fold them.
const extraFolds: Record<string, string> = { ł: 'l', ø: 'o', đ: 'd', ı: 'i', ß: 'ss' }

/** Folds case, accents and spacing so "lukasz" finds "Łukasz". Matches the server's NameKey. */
export function foldName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[łøđıß]/g, (c) => extraFolds[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every word of the query must start a word of the name: "ma ka" finds "Marta Kamińska". */
export function nameMatches(name: string, query: string): boolean {
  const q = foldName(query)
  if (!q) return true
  const words = foldName(name).split(' ')
  return q.split(' ').every((part) => words.some((w) => w.startsWith(part)))
}
