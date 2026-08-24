import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import useBuilderStore, {
  selTotalSpent, selTotalPower, selPsuWattage
} from '../store/useBuilderStore'
import DynamicBars from './DynamicBars'
import ViewTabs from './ViewTabs'

export default function TopBar({ view, onViewChange }) {
  const budget     = useBuilderStore((s) => s.budget)
  const setBudget  = useBuilderStore((s) => s.setBudget)
  const setFlow    = useBuilderStore((s) => s.setFlow)
  const totalSpent = useBuilderStore(selTotalSpent)
  const totalPower = useBuilderStore(selTotalPower)
  const psuwattage = useBuilderStore(selPsuWattage)
  const remaining  = budget - totalSpent

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(String(budget))
    setEditing(true)
  }

  function commit() {
    const num = parseFloat(draft)
    if (num > 0) setBudget(num)
    setEditing(false)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-line px-3 md:px-6 py-2 md:py-3 flex flex-wrap wide:flex-nowrap items-center gap-x-3 md:gap-x-6 gap-y-1">
      <button
        onClick={() => setFlow('hub')}
        aria-label="Back to menu"
        title="Back to the main menu"
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
      </button>
      {/* Below 360px the wordmark is what pushes this header onto a second row,
          so it goes; every real phone width keeps it. */}
      {/* nowrap is load-bearing: once the three zones took their flex-1 share,
          the left group got tight enough that "PC Builder" broke onto two lines
          and took the whole header from 63px to 81px with it. Measured. */}
      {/* @wordmark */}
      <span className="hidden min-[360px]:inline whitespace-nowrap font-display font-extrabold text-lg tracking-tight text-ink">PC <span className="text-accent">Builder</span></span>
      {/* Below `wide` this shrinks to just the editable budget: the remaining
          and power figures move into the meter row underneath, where they get a
          bar to be read against. */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted">
        {editing ? (
          <span className="flex items-center gap-1">
            <span className="text-muted">£</span>
            <input
              autoFocus
              type="number"
              min="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
              className="w-24 bg-surface-2 text-ink font-mono tabular-nums px-2 py-0.5 rounded-lg border border-copper focus:outline-none"
            />
          </span>
        ) : (
          <button
            onClick={startEdit}
            title="Click to edit your budget"
            className="text-ink font-mono tabular-nums font-semibold hover:text-copper border-b border-dashed border-line-strong hover:border-copper transition-colors"
          >
            £{budget.toFixed(0)}
          </button>
        )}
        <span className="text-faint hidden wide:inline">budget</span>
        <span className="text-line-strong mx-0.5 sm:mx-1 hidden wide:inline">|</span>
        <span className={`hidden wide:inline font-mono tabular-nums font-semibold ${remaining < 0 ? 'text-bad' : 'text-good'}`}>
          £{remaining.toFixed(0)}
        </span>
        <span className="text-faint hidden wide:inline">remaining</span>
        <span className="text-line-strong mx-0.5 sm:mx-1 hidden wide:inline">|</span>
        <span className="hidden wide:inline text-ok font-mono tabular-nums font-semibold">{totalPower}W</span>
      </div>
      {/* Three zones: the budget readout above ends the left one. `flex-1` on
          the flanks centres the tabs — but only at `wide`, where both flanks
          carry weight. Between lg and wide the full-size meters are hidden, so
          the tabs sit right of true centre. That is expected; do NOT absolutely
          position them to "fix" it, because they would then overlap the flanks
          and wrap the first row, which has to stay a single line.
          Tabs live in the header on desktop; on phones they are the bottom bar
          rendered by BuilderScreen. */}
      <div className="flex-1 flex justify-end lg:justify-center">
        <ViewTabs view={view} onChange={onViewChange} />
      </div>
      <div className="flex items-center gap-3 md:gap-4 lg:flex-1 lg:justify-end">
        <a href="/feedback" className="text-xs text-muted hover:text-copper transition-colors">Feedback</a>
        {/* `wide` (1420px), not xl (1280px), and the difference is measured
            rather than taste: back arrow + wordmark + the budget/remaining/
            power text + four tabs + these two chips come to 1403px of content.
            Revealed at xl they ran to 1403px inside a 1280px window and the
            POWER figure was cut off — silently, because
            `scrollWidth === clientWidth` there and no scrollbar ever appeared.
            Guarded by e2e/topBar.spec.js, which measures every box in the
            header rather than trusting a class name. */}
        <div className="hidden wide:flex gap-3">
          <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
          <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
        </div>
      </div>
      {/* Every width below `wide` gets the same two meters on their own row —
          the exact complement of the full-size pair above, so the readout never
          just vanishes as the window narrows. Wrapping is safe: `w-full` means
          this row can never share a line, so it is the only thing that wraps,
          and BuilderScreen pads the content below to clear it.
          ⚠️ That only works while the header can actually wrap. It carried
          `md:flex-nowrap` for a while, which cancelled the wrap from 768px up
          and left this row laid out INLINE — where it ran 41px off the right
          edge at 1024px. Hence `wide:flex-nowrap`: nowrap only where this row
          is hidden anyway. Same reason the row gap is `md:gap-x-6` and not
          `md:gap-6` — the shorthand set a 24px gap on BOTH axes, which put the
          two-row header at 110px against 96px of content padding. */}
      <div className="w-full flex items-center gap-4 wide:hidden">
        <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" compact />
        <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" compact />
      </div>
    </header>
  )
}
