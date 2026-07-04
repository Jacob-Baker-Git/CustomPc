import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import useBuilderStore, {
  selTotalSpent, selTotalPower, selPsuWattage
} from '../store/useBuilderStore'
import DynamicBars from './DynamicBars'

export default function TopBar() {
  const budget     = useBuilderStore((s) => s.budget)
  const setBudget  = useBuilderStore((s) => s.setBudget)
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/30 backdrop-blur-md border-b border-slate-800/60 px-3 md:px-6 py-2 md:py-3 flex flex-wrap md:flex-nowrap items-center gap-x-3 md:gap-8 gap-y-1">
      <button
        onClick={() => setBudget(0)}
        aria-label="Back to budget screen"
        title="Back to the budget & quick-start screen (your build is kept)"
        className="w-7 h-7 flex items-center justify-center rounded-sm border border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
      </button>
      <span className="font-bold text-lg tracking-tight text-white">PC <span className="text-cyan-400">Builder</span></span>
      <div className="flex items-center gap-2 text-sm text-gray-300">
        {editing ? (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">£</span>
            <input
              autoFocus
              type="number"
              min="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
              className="w-24 bg-slate-900/80 text-white font-mono px-2 py-0.5 rounded-sm border border-cyan-400 focus:outline-none"
            />
          </span>
        ) : (
          <button
            onClick={startEdit}
            title="Click to edit your budget"
            className="text-white font-mono font-semibold hover:text-cyan-300 border-b border-dashed border-gray-600 hover:border-cyan-400 transition-colors"
          >
            £{budget.toFixed(0)}
          </button>
        )}
        <span className="text-gray-500">budget</span>
        <span className="text-gray-600 mx-1">|</span>
        <span className={remaining < 0 ? 'text-red-400 font-mono font-semibold' : 'text-green-400 font-mono font-semibold'}>
          £{remaining.toFixed(0)}
        </span>
        <span className="text-gray-500">remaining</span>
        <span className="text-gray-600 mx-1">|</span>
        <span className="text-amber-400 font-mono font-semibold">{totalPower}W</span>
      </div>
      <div className="hidden md:flex gap-6 ml-auto">
        <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
        <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
      </div>
    </header>
  )
}
