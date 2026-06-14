import { useState } from 'react'
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
      <span className="text-white font-bold text-lg tracking-tight">PC Builder</span>
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
              className="w-24 bg-gray-800 text-white px-2 py-0.5 rounded border border-blue-500 focus:outline-none"
            />
          </span>
        ) : (
          <button
            onClick={startEdit}
            title="Click to edit your budget"
            className="text-white font-semibold hover:text-blue-300 border-b border-dashed border-gray-600 hover:border-blue-400"
          >
            £{budget.toFixed(0)}
          </button>
        )}
        <span className="text-gray-500">budget</span>
        <span className="text-gray-600 mx-1">|</span>
        <span className={remaining < 0 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
          £{remaining.toFixed(0)}
        </span>
        <span className="text-gray-500">remaining</span>
        <span className="text-gray-600 mx-1">|</span>
        <span className="text-amber-400 font-semibold">{totalPower}W</span>
      </div>
      <div className="flex gap-6 ml-auto">
        <DynamicBars value={totalSpent} max={budget} label="Budget" unit="£" />
        <DynamicBars value={totalPower} max={psuwattage} label="Power" unit="W" />
      </div>
    </header>
  )
}
