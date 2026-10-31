// Three invented desks for the demo. Every name is made up; real rosters
// never enter the repository. Times are relative to when the demo opens, so
// loans always look current.
import type { Settings } from '@/lib/types'
import type { Snapshot } from './desk'

export type Scenario = 'cards' | 'keys' | 'laptops'

interface Plan {
  settings: Partial<Settings>
  team: string[]
  items: [label: string, code: string][]
  people: string[]
  /** item index, person, minutes ago, returned minutes ago */
  loans: [number, string, number, number?][]
  condition?: [number, 'lost' | 'damaged', string][]
}

const students = ['Anna Kowalska', 'Jan Nowak', 'Zofia Wiśniewska', 'Mateusz Lewandowski', 'Ola Wójcik', 'Marta Kamińska',
  'Marek Dąbrowski', 'Maria Szymańska', 'Tomasz Wróbel', 'Paweł Kaczmarek', 'Łucja Zielińska', 'Ümit Demir',
  'Lena Fischer', 'Diego Ramírez', 'Mariana Costa', 'Oksana Melnyk']

const plans: Record<Scenario, Plan> = {
  cards: {
    settings: { language: 'en', branding: '42warsaw', overdue_minutes: 180 },
    team: ['Kasia M.', 'Piotr W.'],
    items: Array.from({ length: 10 }, (_, n) => [String(n + 1), `carddesk:${n + 1}`]),
    people: students,
    loans: [[1, 'Anna Kowalska', 134], [3, 'Jan Nowak', 159], [4, 'Mateusz Lewandowski', 21], [6, 'Zofia Wiśniewska', 399],
      [9, 'Ola Wójcik', 17], [0, 'Tomasz Wróbel', 50, 19], [2, 'Lena Fischer', 260, 200], [7, 'Diego Ramírez', 300, 120]],
    condition: [[8, 'damaged', 'Cracked corner']],
  },
  keys: {
    settings: {
      language: 'en', branding: 'none', overdue_minutes: 120,
      labels: {
        en: { item: 'Key', items: 'Keys', borrower: 'Member', borrowers: 'Members', desk: 'Makerspace key desk' },
        pl: { item: 'Klucz', items: 'Klucze', borrower: 'Członek', borrowers: 'Członkowie', desk: 'Klucze pracowni' },
      },
    },
    team: ['Robin K.'],
    items: [['Wood', 'key:wood'], ['Metal', 'key:metal'], ['Laser', 'key:laser'], ['3D', 'key:3d'], ['Paint', 'key:paint'],
      ['Storeroom', 'key:store'], ['Roof', 'key:roof'], ['Van', 'key:van']],
    people: ['Sam Okafor', 'Ingrid Berg', 'Tariq Haddad', 'Mei Lin', 'Jonas Weber', 'Priya Nair', 'Hugo Martin', 'Ada Novak'],
    loans: [[0, 'Sam Okafor', 45], [2, 'Mei Lin', 100], [5, 'Jonas Weber', 160], [7, 'Priya Nair', 12], [1, 'Hugo Martin', 90, 30]],
    condition: [[6, 'lost', 'Not returned after the open day']],
  },
  laptops: {
    settings: {
      language: 'pl', branding: 'none', overdue_minutes: 90,
      labels: {
        en: { item: 'Laptop', items: 'Laptops', borrower: 'Pupil', borrowers: 'Pupils', desk: 'Laptop trolley' },
        pl: { item: 'Laptop', items: 'Laptopy', borrower: 'Uczeń', borrowers: 'Uczniowie', desk: 'Wypożyczalnia laptopów' },
      },
    },
    team: ['p. Nowicka', 'Kuba'],
    items: Array.from({ length: 12 }, (_, n) => [`L${String(n + 1).padStart(2, '0')}`, `laptop:${n + 1}`]),
    people: students,
    loans: [[0, 'Marta Kamińska', 30], [1, 'Paweł Kaczmarek', 70], [2, 'Łucja Zielińska', 95], [4, 'Marek Dąbrowski', 15],
      [5, 'Maria Szymańska', 40], [8, 'Oksana Melnyk', 55], [10, 'Mariana Costa', 5], [3, 'Ümit Demir', 120, 60]],
    condition: [[11, 'damaged', 'Pęknięty zawias']],
  },
}

const defaults: Settings = {
  labels: {
    en: { item: 'Card', items: 'Cards', borrower: 'Student', borrowers: 'Students', desk: 'Access card desk' },
    pl: { item: 'Karta', items: 'Karty', borrower: 'Uczestnik', borrowers: 'Uczestnicy', desk: 'Wypożyczalnia kart' },
  },
  language: 'en',
  branding: '42warsaw',
  volunteers: [],
  overdue_minutes: 180,
  closing_time: '',
}

export function fixture(scenario: Scenario): Snapshot {
  const plan = plans[scenario]
  let next = 1
  const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString()
  const items = plan.items.map(([label, code]) => ({ id: next++, label, code, condition: 'ok' as const, note: '' }))
  const borrowers = plan.people.map((name) => ({ id: next++, name, active: true }))
  const person = (name: string) => borrowers.find((b) => b.name === name)!.id
  const team = plan.team.join(', ')
  const loans = [...plan.loans]
    .sort((a, b) => b[2] - a[2])
    .map(([i, name, ago, back]) => ({
      id: next++,
      item_id: items[i].id,
      borrower_id: person(name),
      lent_at: at(ago),
      lent_by: team,
      ...(back === undefined ? {} : { returned_at: at(back), returned_by: team, close_reason: 'returned' as const }),
    }))
  for (const [i, condition, note] of plan.condition ?? []) Object.assign(items[i], { condition, note })
  return { version: 1, settings: { ...defaults, ...plan.settings, volunteers: plan.team }, items, borrowers, loans, next }
}
