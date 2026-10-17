import { useMemo, useState } from 'react'
import useDialog from '../hooks/useDialog'
import useBuilderStore, { selRemainingBudget } from '../store/useBuilderStore'
import { filterParts } from '../lib/partFilter'
import { categoryLabel } from '../lib/categories'
import { sortParts, SORT_OPTIONS } from '../lib/sortParts'
import PartCard from './PartCard'
import SearchBar from './SearchBar'
import useCatalogStore from '../store/useCatalogStore'
import PartTable from './PartTable'
import { columnsFor } from '../lib/partColumns'
import { useIsDesktop } from '../hooks/useIsDesktop'

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
  const resolution = useBuilderStore((s) => s.resolution)
  // Desktop compares in a table sorted by its headers; a phone keeps the cards
  // and the sort menu (spec 2026-10-17).
  const desktop = useIsDesktop()
  const [tableSort, setTableSort] = useState(null)
  const columns = useMemo(() => columnsFor(category, resolution), [category, resolution])

  const current = selectedParts[category]

  const ref = useDialog(onClose)

  const parts = useMemo(
    () => partsData.filter((p) => p.category === category),
    [partsData, category]
  )

  const sorted = useMemo(() => sortParts(parts, sortKey), [parts, sortKey])

  const visible = useMemo(
    () => filterParts(sorted, selectedParts, showAll ? 0 : budget, query),
    [sorted, selectedParts, budget, query, showAll]
  )

  // Swapping replaces the current part, so credit its price back.
  const swapBudget = remainingBudget + (current?.price ?? 0)
  const rows = useMemo(() => {
    const annotated = visible.map((v) => {
      // `budget` is 0 when there is none (or ignoreBudget is set), as in
      // filterParts — nothing is over a budget that does not exist.
      const overBudget = budget > 0 && v.part.price > swapBudget
      return { ...v, locked: !v.compatible || overBudget, lockReason: !v.compatible ? v.reason : 'Over remaining budget' }
    })
    if (!tableSort) return annotated
    const col = columns.find((c) => c.key === tableSort.key)
    const val = (p) => (col ? col.value(p) : p.name)
    const sign = tableSort.dir === 'asc' ? 1 : -1
    // Missing values last whichever way round.
    return [...annotated].sort((a, b) => {
      const x = val(a.part)
      const y = val(b.part)
      if (x == null || y == null) return (x == null) - (y == null)
      return sign * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y)))
    })
  }, [visible, budget, swapBudget, tableSort, columns])
  const sortBy = (key) => setTableSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  // Parts hidden by the default budget-fit cutoff (60% of total budget).
  const hiddenCount = useMemo(() => {
    if (query || showAll) return 0
    return filterParts(sorted, selectedParts, 0, '').length - visible.length
  }, [sorted, selectedParts, query, showAll, visible])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Select ${category}`}
        onKeyDown={(e) => {
          // "/" jumps to search, as on most catalogue sites; not while typing.
          if (e.key !== '/' || e.target.closest?.('input, textarea, select')) return
          e.preventDefault()
          ref.current?.querySelector('input')?.focus()
        }}
        className={`bg-surface rounded-xl w-full flex flex-col border border-line shadow-2xl ${desktop ? 'max-w-6xl max-h-[88vh]' : 'max-w-4xl max-h-[80vh]'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line gap-4">
          <h2 className="font-display text-xl font-bold whitespace-nowrap text-ink">{categoryLabel(category)}</h2>
          <div className="flex-1 max-w-sm">
            <SearchBar value={query} onChange={setQuery} placeholder={`Search ${category}...`} />
          </div>
          {!desktop && <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            aria-label="Sort parts"
            className="bg-surface-2 border border-line rounded-lg text-xs text-ink px-2 py-2 focus:outline-hidden focus:border-brass"
          >
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>}
          <button onClick={onClose} aria-label="Close" className="min-h-6 min-w-6 text-muted hover:text-ink text-2xl leading-none">&times;</button>
        </div>
        <div className={desktop ? 'overflow-y-auto px-6 pb-6' : 'overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-4'}>
          {visible.length === 0 && (
            <p className="col-span-full text-center text-muted py-8">No parts match.</p>
          )}
          {desktop ? (
            visible.length > 0 && (
              <PartTable rows={rows} columns={columns} sort={tableSort} onSort={sortBy}
                         currentId={current?.id} onPick={(p) => { onSelect(p); onClose() }} />
            )
          ) : rows.map(({ part, locked, lockReason }) => (
            <PartCard
              key={part.id}
              part={part}
              locked={locked}
              lockReason={lockReason}
              selected={current?.id === part.id}
              onSelect={(p) => { onSelect(p); onClose() }}
            />
          ))}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="col-span-full lg:mt-4 w-full text-xs text-muted hover:text-brass border border-dashed border-line hover:border-brass rounded-lg py-2.5 transition-colors"
            >
              Show {hiddenCount} pricier part{hiddenCount === 1 ? '' : 's'} above the budget-fit cutoff
            </button>
          )}
          {showAll && !query && (
            <button
              onClick={() => setShowAll(false)}
              className="col-span-full lg:mt-4 w-full text-xs text-muted hover:text-brass border border-dashed border-line hover:border-brass rounded-lg py-2.5 transition-colors"
            >
              Hide pricier parts
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
