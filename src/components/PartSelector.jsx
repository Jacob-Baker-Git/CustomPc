import { useMemo, useState } from 'react'
import useBuilderStore, { selRemainingBudget } from '../store/useBuilderStore'
import { filterParts } from '../lib/partFilter'
import PartCard from './PartCard'
import SearchBar from './SearchBar'
import partsData from '../data/partsData.json'

export default function PartSelector({ category, onSelect, onClose }) {
  const selectedParts   = useBuilderStore((s) => s.selectedParts)
  const budget          = useBuilderStore((s) => s.budget)
  const remainingBudget = useBuilderStore(selRemainingBudget)
  const [query, setQuery] = useState('')

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [category]
  )

  const visible = useMemo(
    () => filterParts(parts, selectedParts, budget, query),
    [parts, selectedParts, budget, query]
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 gap-4">
          <h2 className="text-white text-xl font-bold capitalize whitespace-nowrap">{category}</h2>
          <div className="flex-1 max-w-sm">
            <SearchBar value={query} onChange={setQuery} placeholder={`Search ${category}...`} />
          </div>
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
