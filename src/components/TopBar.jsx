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
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-line px-3 md:px-6 py-2 md:py-3 flex flex-wrap md:flex-nowrap items-center gap-x-3 md:gap-8 gap-y-1">
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
      <span className="hidden min-[360px]:inline font-display font-extrabold text-lg tracking-tight text-ink">PC <span className="text-accent">Builder</span></span>
      {/* Below `xl` this shrinks to just the editable budget: the remaining and
          power figures move into the meter row underneath, where they get a bar
          to be read against. */}
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
        <span className="text-faint hidden xl:inline">budget</span>
        <span className="text-line-strong mx-0.5 sm:mx-1 hidden xl:inline">|</span>
        <span className={`hidden xl:inline font-mono tabular-nums font-semibold ${remaining < 0 ? 'text-bad' : 'text-good'}`}>
          £{remaining.toFixed(0)}
        </span>
        <span className="text-faint hidden xl:inline">remaining</span>
        <span className="text-line-strong mx-0.5 sm:mx-1 hidden xl:inline">|</span>
        <span className="hidden xl:inline text-ok font-mono tabular-nums font-semibold">{totalPower}W</span>
      </div>
      {/* Tabs live in the header on desktop; on phones they are the bottom bar
          rendered by BuilderScreen, so this row stays one row at 375px. */}
      <div className="ml-auto flex items-center gap-3 md:gap-4">
        <ViewTabs view={view} onChange={onViewChange} />
        <a href="#/feedback" className="text-xs text-muted hover:text-accent transition-colors">Feedback</a>
        {/* xl, not lg: at 1024 the tabs have just moved in and the bars no
            longer fit beside them without wrapping the header. */}
        <div className="hidden xl:flex gap-6">
          <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
          <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
        </div>
      </div>
      {/* Every width below `xl` gets the same two meters on their own row — the
          exact complement of the full-size pair above, so the readout never just
          vanishes as the window narrows. Wrapping is safe: this row is the only
          thing that wraps, and the content below is padded to clear it. */}
      <div className="w-full flex items-center gap-4 xl:hidden">
        <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" compact />
        <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" compact />
      </div>
    </header>
  )
}
