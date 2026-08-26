import { useEffect, useMemo, useState } from 'react'
import useBuilderStore, { selRemainingBudget } from '../store/useBuilderStore'
import { filterParts } from '../lib/partFilter'
import { categoryLabel } from '../lib/categories'
import { sortParts, SORT_OPTIONS } from '../lib/sortParts'
import PartCard from './PartCard'
import SearchBar from './SearchBar'
import useCatalogStore from '../store/useCatalogStore'

export default function PartSelector({ category, onSelect, onClose, contextParts, ignoreBudget = false }) {
  const storeSelected   = useBuilderStore((s) => s.selectedParts)
  const storeBudget     = useBuilderStore((s) => s.budget)
  const remainingBudget = useBuilderStore(selRemainingBudget)
  const selectedParts   = contextParts ?? storeSelected
  const budget          = ignoreBudget ? 0 : storeBudget
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('price-asc')
  const [showAll, setShowAll] = useState(false)
  const partsData = useCatalogStore((s) => s.parts)

  const current = selectedParts[category]

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [partsData, category]
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
        className="bg-surface rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-line shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line gap-4">
          <h2 className="font-display text-xl font-bold whitespace-nowrap text-ink">{categoryLabel(category)}</h2>
          <div className="flex-1 max-w-sm">
            <SearchBar value={query} onChange={setQuery} placeholder={`Search ${category}...`} />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            aria-label="Sort parts"
            className="bg-surface-2 border border-line rounded-lg text-xs text-ink px-2 py-2 focus:outline-none focus:border-brass"
          >
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {visible.length === 0 && (
            <p className="col-span-full text-center text-muted py-8">No parts match.</p>
          )}
          {visible.map(({ part, compatible, reason }) => {
            // Swapping replaces the current part, so credit its price back.
            const swapBudget = remainingBudget + (current?.price ?? 0)
            const overBudget = ignoreBudget ? false : part.price > swapBudget
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
              className="col-span-full text-xs text-muted hover:text-brass border border-dashed border-line hover:border-brass rounded-lg py-2.5 transition-colors"
            >
              Show {hiddenCount} pricier part{hiddenCount === 1 ? '' : 's'} above the budget-fit cutoff
            </button>
          )}
          {showAll && !query && (
            <button
              onClick={() => setShowAll(false)}
              className="col-span-full text-xs text-muted hover:text-brass border border-dashed border-line hover:border-brass rounded-lg py-2.5 transition-colors"
            >
              Hide pricier parts
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
