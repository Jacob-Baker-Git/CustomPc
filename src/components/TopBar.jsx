import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import useBuilderStore, {
  selTotalSpent, selTotalPower, selPsuWattage
} from '../store/useBuilderStore'
import DynamicBars from './DynamicBars'

export default function TopBar() {
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-line px-3 md:px-6 py-2 md:py-3 flex flex-wrap md:flex-nowrap items-center gap-x-3 md:gap-8 gap-y-1">
      <button
        onClick={() => { setBudget(0); setFlow('menu') }}
        aria-label="Back to menu"
        title="Back to the main menu (your build is kept)"
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
      </button>
      <span className="font-display font-extrabold text-lg tracking-tight text-ink">PC <span className="text-accent">Builder</span></span>
      {/* Compact on phones (values only, smaller text) so the header stays ONE
          row — a wrapped two-row header covered the view tabs underneath. */}
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
              className="w-24 bg-surface-2 text-ink font-mono tabular-nums px-2 py-0.5 rounded-lg border border-accent focus:outline-none"
            />
          </span>
        ) : (
          <button
            onClick={startEdit}
            title="Click to edit your budget"
            className="text-ink font-mono tabular-nums font-semibold hover:text-accent border-b border-dashed border-line-strong hover:border-accent transition-colors"
          >
            £{budget.toFixed(0)}
          </button>
        )}
        <span className="text-faint hidden sm:inline">budget</span>
        <span className="text-line-strong mx-0.5 sm:mx-1">|</span>
        <span className={remaining < 0 ? 'text-bad font-mono tabular-nums font-semibold' : 'text-good font-mono tabular-nums font-semibold'}>
          £{remaining.toFixed(0)}
        </span>
        <span className="text-faint hidden sm:inline">remaining</span>
        <span className="text-line-strong mx-0.5 sm:mx-1">|</span>
        <span className="text-ok font-mono tabular-nums font-semibold">{totalPower}W</span>
      </div>
      <div className="ml-auto flex items-center gap-3 md:gap-4">
        <a href="#/feedback" className="text-xs text-muted hover:text-accent transition-colors">Feedback</a>
        <div className="hidden md:flex gap-6">
          <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
          <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
        </div>
      </div>
    </header>
  )
}
