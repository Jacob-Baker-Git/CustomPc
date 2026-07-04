import { useEffect, useMemo, useState } from 'react'
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
  const [showAll, setShowAll] = useState(false)

  const current = selectedParts[category]

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [category]
  )

  const sorted = useMemo(() => sortParts(parts, sortKey), [parts, sortKey])

  const visible = useMemo(
    () => filterParts(sorted, selectedParts, showAll ? 0 : budget, query),
    [sorted, selectedParts, budget, query, showAll]
  )

  // Parts hidden by the default budget-fit cutoff (60% of total budget).
  const hiddenCount = useMemo(() => {
    if (query || showAll) return 0
    return filterParts(sorted, selectedParts, 0, '').length - visible.length
  }, [sorted, selectedParts, query, showAll, visible])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Select ${category}`}
        className="bg-slate-950/80 backdrop-blur-xl rounded-sm w-full max-w-4xl max-h-[80vh] flex flex-col border border-slate-800/60 shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 gap-4">
          <h2 className="text-xl font-bold capitalize whitespace-nowrap text-white">{category}</h2>
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
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {visible.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-8">No parts match.</p>
          )}
          {visible.map(({ part, compatible, reason }) => {
            // Swapping replaces the current part, so credit its price back.
            const swapBudget = remainingBudget + (current?.price ?? 0)
            const overBudget = part.price > swapBudget
            const locked     = !compatible || overBudget
            const lockReason = !compatible ? reason : 'Over remaining budget'
            return (
              <PartCard
                key={part.id}
                part={part}
                locked={locked}
                lockReason={lockReason}
                selected={current?.id === part.id}
                onSelect={(p) => { onSelect(p); onClose() }}
              />
            )
          })}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="col-span-full text-xs text-slate-400 hover:text-cyan-300 border border-dashed border-slate-700/70 hover:border-cyan-400/60 rounded-sm py-2.5 transition-colors"
            >
              Show {hiddenCount} pricier part{hiddenCount === 1 ? '' : 's'} above the budget-fit cutoff
            </button>
          )}
          {showAll && !query && (
            <button
              onClick={() => setShowAll(false)}
              className="col-span-full text-xs text-slate-400 hover:text-cyan-300 border border-dashed border-slate-700/70 hover:border-cyan-400/60 rounded-sm py-2.5 transition-colors"
            >
              Hide pricier parts
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
