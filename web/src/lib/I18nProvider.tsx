import { useCallback, useMemo, type ReactNode } from 'react'
import { dictionaries, english, I18nContext, type Translate, type Vars } from './i18n'
import type { Labels, Language } from './types'

export function I18nProvider({ lang, labels, children }: { lang: Language; labels: Labels; children: ReactNode }) {
  const t = useCallback<Translate>(
    (key, vars = {}) => {
      const all: Vars = {
        item: labels.item,
        item_lc: labels.item.toLocaleLowerCase(lang),
        items: labels.items,
        items_lc: labels.items.toLocaleLowerCase(lang),
        borrower: labels.borrower,
        borrower_lc: labels.borrower.toLocaleLowerCase(lang),
        borrowers: labels.borrowers,
        borrowers_lc: labels.borrowers.toLocaleLowerCase(lang),
        ...vars,
      }
      const template = dictionaries[lang][key] ?? english[key]
      return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in all ? String(all[name]) : m))
    },
    [lang, labels],
  )
  const value = useMemo(() => ({ t, lang, locale: lang === 'pl' ? 'pl-PL' : 'en-GB' }), [t, lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

