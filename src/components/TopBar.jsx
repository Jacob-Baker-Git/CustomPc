import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import useBuilderStore, {
  selTotalSpent, selPeakDraw, selPsuWattage
} from '../store/useBuilderStore'
import DynamicBars from './DynamicBars'

// One row at every width (configurator redesign, spec 2026-10-16): back to the
// Welcome screen, the wordmark and the editable budget. The steps moved to
// StepHeader underneath, and on a phone the running total moved to the Dock,
// so the Budget/Power meters only show from `lg`, where there is room for them
// beside everything else. The money-left figure joins them at `wide`.
export default function TopBar() {
  const budget     = useBuilderStore((s) => s.budget)
  const setBudget  = useBuilderStore((s) => s.setBudget)
  const setFlow    = useBuilderStore((s) => s.setFlow)
  const totalSpent = useBuilderStore(selTotalSpent)
  const totalPower = useBuilderStore(selPeakDraw)
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
    <header className="flex items-center gap-x-3 border-b border-line bg-ground px-3 py-2 md:gap-x-6 md:px-6">
      <button
        onClick={() => setFlow('hub')}
        aria-label="Back to menu"
        title="Back to the main menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden="true" />
      </button>
      {/* @wordmark. Hidden below 360px, the one width where it would push the
          budget off the row. */}
      <span className="hidden whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-ink min-[360px]:inline">PC <span className="text-accent">Builder</span></span>
      <div className="flex items-center gap-1.5 text-sm text-muted sm:gap-2">
        {editing ? (
          <span className="flex items-center gap-1">
            <span className="text-muted">£</span>
            <input
              autoFocus
              type="number"
              min="1"
              aria-label="Budget"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
              className="w-24 rounded-lg border border-brass bg-surface-2 px-2 py-0.5 font-mono tabular-nums text-ink focus:outline-none"
            />
          </span>
        ) : (
          <button
            onClick={startEdit}
            title="Click to edit your budget"
            className="border-b border-dashed border-line-strong font-mono font-semibold tabular-nums text-ink transition-colors hover:border-brass hover:text-brass"
          >
            £{budget.toFixed(0)}
          </button>
        )}
        <span className="mx-1 hidden text-line-strong wide:inline">|</span>
        <span className={`hidden font-mono font-semibold tabular-nums wide:inline ${remaining < 0 ? 'text-bad' : 'text-good'}`}>
          £{remaining.toFixed(0)}
        </span>
        <span className="hidden text-faint wide:inline">left</span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-4">
        <a href="/feedback" className="text-xs text-muted transition-colors hover:text-brass">Feedback</a>
        <div className="hidden gap-3 lg:flex">
          <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
          <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
        </div>
      </div>
    </header>
  )
}
