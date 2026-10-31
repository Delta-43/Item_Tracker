import { RotateCcw } from 'lucide-react'
import { current, reset, scenarios } from './install'

const names = { cards: 'Access cards', keys: 'Keys', laptops: 'Laptops (PL)' } as const

/** Demo controls at the end of the legend row: which invented desk to show, and a way to start it over. */
export function DemoBar() {
  return (
    <div className="fixed top-[5.25rem] right-[calc(clamp(18rem,28vw,26rem)+1.5rem)] z-40 flex items-center gap-1 rounded-full border bg-navy-deep/95 py-1 pr-1 pl-3 text-sm shadow-[0_4px_16px_rgb(0_0_0/0.3)]">
      <span className="font-semibold tracking-[0.12em] text-teal uppercase">Demo</span>
      <select
        aria-label="Demo desk"
        value={current}
        onChange={(e) => location.assign(`?desk=${e.target.value}`)}
        className="cursor-pointer rounded-full bg-transparent px-2 py-1 text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal"
      >
        {scenarios.map((s) => (
          <option key={s} value={s} className="bg-navy-deep">
            {names[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={reset}
        aria-label="Reset this demo desk"
        title="Reset this demo desk"
        className="grid size-7 place-items-center rounded-full text-mist transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-teal focus-visible:outline-none"
      >
        <RotateCcw aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}
