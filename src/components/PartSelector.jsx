import { useMemo, useState } from 'react'
import useBuilderStore, { selRemainingBudget } from '../store/useBuilderStore'
import { filterParts } from '../lib/partFilter'
import { sortParts, SORT_OPTIONS } from '../lib/sortParts'
import PartCard from './PartCard'
import SearchBar from './SearchBar'
import partsData from '../data/partsData.json'

export default function PartSelector({ category, onSelect, onClose }) {
  const selectedParts   = useBuilderStore((s) => s.selectedParts)
  const budget          = useBuilderStore((s) => s.budget)
  const remainingBudget = useBuilderStore(selRemainingBudget)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('price-asc')

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [category]
  )

  const sorted = useMemo(() => sortParts(parts, sortKey), [parts, sortKey])

  const visible = useMemo(
    () => filterParts(sorted, selectedParts, budget, query),
    [sorted, selectedParts, budget, query]
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-gray-900/80 backdrop-blur-xl rounded-3xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-white/10 shadow-[0_0_40px_rgba(34,211,238,0.15)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 gap-4">
          <h2 className="text-xl font-bold capitalize whitespace-nowrap bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">{category}</h2>
          <div className="flex-1 max-w-sm">
            <SearchBar value={query} onChange={setQuery} placeholder={`Search ${category}...`} />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            aria-label="Sort parts"
            className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-xs text-slate-100 px-2 py-2 focus:outline-none focus:border-cyan-400"
          >
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {visible.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-8">No parts match.</p>
          )}
          {visible.map(({ part, compatible, reason }) => {
            const overBudget = part.price > remainingBudget
            const locked     = !compatible || overBudget
            const lockReason = !compatible ? reason : 'Over remaining budget'
            return (
              <PartCard
                key={part.id}
                part={part}
                locked={locked}
                lockReason={lockReason}
                onSelect={(p) => { onSelect(p); onClose() }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
