import { useMemo, useState } from 'react'
import { Monitor, Keyboard, Mouse, Headphones, Check, SlidersHorizontal } from 'lucide-react'
import useBuilderStore, { selPeripheralsTotal } from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import SpecSheet from './SpecSheet'
import PeripheralFilterPanel from './PeripheralFilterPanel'
import { PANEL, TELEMETRY } from '../lib/uiTokens'
import {
  filterPeripherals, specValues, SORTS, DEFAULT_SORT,
  brandValues, refreshBandsFor, toFilterOptions,
  EMPTY_FILTERS, activeFilterCount,
} from '../lib/peripheralFilter'

const CATEGORIES = [
  { id: 'monitor',  label: 'Monitor',  icon: Monitor,    blurb: 'The one part you actually look at' },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard,   blurb: 'Membrane is fine; mechanical lasts' },
  { id: 'mouse',    label: 'Mouse',    icon: Mouse,      blurb: 'Shape matters more than DPI' },
  { id: 'headset',  label: 'Headset',  icon: Headphones, blurb: 'Wired sounds better per pound' },
]

function specLine(p) {
  if (p.category === 'monitor') return `${p.resolution} · ${p.refresh}Hz`
  if (p.category === 'keyboard') return `${p.switch} switches`
  if (p.category === 'mouse') return `${p.dpi.toLocaleString()} DPI`
  if (p.category === 'headset') return p.type
  return ''
}

function PeripheralCard({ p, isSelected, onToggle }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div
      className={`relative rounded-xl border p-4 flex flex-col gap-2 transition-colors
        ${isSelected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'}`}
    >
      {isSelected && (
        <span className="absolute top-2 right-2 flex items-center gap-1 text-accent text-[10px] font-semibold">
          <Check size={11} aria-hidden="true" /> Picked
        </span>
      )}
      <button
        type="button"
        onClick={onToggle}
        title={isSelected ? 'Click to deselect' : 'Click to select'}
        className="text-left flex flex-col cursor-pointer focus-visible:outline-accent"
      >
        <div className="text-sm font-semibold text-ink leading-tight pr-14">{p.name}</div>
        <div className={`${TELEMETRY} font-bold text-accent mt-1`}>£{p.price.toFixed(2)}</div>
        <div className="text-xs text-muted mt-1">{specLine(p)}</div>
      </button>
      <button
        type="button"
        aria-label={`More info about ${p.name}`}
        aria-expanded={showInfo}
        onClick={() => setShowInfo((v) => !v)}
        className="self-start text-[11px] text-muted hover:text-accent border border-line hover:border-accent rounded-lg px-2 py-0.5 transition-colors"
      >
        {showInfo ? 'Hide info' : 'Info'}
      </button>
      {showInfo && <SpecSheet part={p} />}
    </div>
  )
}

export default function PeripheralsPanel() {
  const selected         = useBuilderStore((s) => s.selectedPeripherals)
  const addPeripheral    = useBuilderStore((s) => s.addPeripheral)
  const removePeripheral = useBuilderStore((s) => s.removePeripheral)
  const total            = useBuilderStore(selPeripheralsTotal)
  const peripheralsData  = useCatalogStore((s) => s.peripherals)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(DEFAULT_SORT)

  const byCategory = useMemo(() => {
    const map = {}
    for (const { id } of CATEGORIES) {
      const all = peripheralsData.filter((p) => p.category === id).sort((a, b) => a.price - b.price)
      map[id] = { all }
    }
    return map
  }, [peripheralsData])

  // Everything the filter panel can offer, derived from the catalogue so a
  // chip never exists for a value nothing has. Brands are pooled across all
  // four categories because the filter itself is global.
  const filterOptions = useMemo(() => ({
    brands: brandValues(peripheralsData),
    resolution: specValues(byCategory.monitor?.all ?? [], 'monitor'),
    refreshBands: refreshBandsFor(byCategory.monitor?.all ?? []),
    switch: specValues(byCategory.keyboard?.all ?? [], 'keyboard'),
    type: specValues(byCategory.headset?.all ?? [], 'headset'),
  }), [peripheralsData, byCategory])

  const filterCount = activeFilterCount(filters)
  const anyFilter = query.trim() !== '' || sort !== DEFAULT_SORT || filterCount > 0

  const clearAll = () => {
    setQuery('')
    setSort(DEFAULT_SORT)
    setFilters(EMPTY_FILTERS)
  }

  const pickedCount = CATEGORIES.filter((c) => selected[c.id]).length

  return (
    <div className="w-full p-4 sm:p-6 pb-12">
      <div className="max-w-5xl mx-auto">
        {/* A running total and a progress line, so the tab says how far along you
            are rather than just listing four unrelated grids. */}
        <div className={`${PANEL} p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2`}>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Peripherals</h2>
            <p className="text-xs text-muted mt-0.5">Optional — they are counted separately from the build budget.</p>
          </div>
          <div className="ml-auto flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-faint">Chosen</div>
              <div className={`${TELEMETRY} text-sm text-ink`}>{pickedCount} / {CATEGORIES.length}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-faint">Subtotal</div>
              <div className={`${TELEMETRY} text-sm font-semibold text-accent`}>£{total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Search and sort apply across all four groups — with ~120 items and no
            way to look one up, price bands alone were doing too much work. */}
        <div className="flex flex-wrap gap-2 items-center mb-6">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search peripherals…"
            aria-label="Search peripherals by name or brand"
            className="flex-1 min-w-48 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort peripherals"
            className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
          >
            {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-haspopup="dialog"
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors
              ${filterCount > 0
                ? 'border-accent text-accent bg-accent-soft'
                : 'border-line text-muted hover:text-ink hover:border-line-strong'}`}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            Filters
            {filterCount > 0 && (
              <span className={`${TELEMETRY} rounded-full bg-accent text-accent-ink px-1.5 text-[10px] font-bold`}>
                {filterCount}
              </span>
            )}
          </button>
          {anyFilter && (
            <button
              onClick={clearAll}
              className="text-xs px-3 py-2 rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="space-y-8">
          {CATEGORIES.map(({ id, label, icon: Icon, blurb }) => {
            const { all } = byCategory[id] ?? { all: [] }
            // Price bands and the single spec chip row used to live inline here,
            // one set per category. They are in the Filters panel now — four
            // stacked chip rows pushed the actual products below the fold, and
            // multi-select does not fit a radiogroup.
            const shown = filterPeripherals(all, toFilterOptions(id, filters, { query, sort }))
            const picked = selected[id]
            return (
              <section key={id}>
                <div className="flex items-baseline gap-2 mb-3">
                  <Icon size={15} className="text-accent shrink-0 self-center" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">{label}</h3>
                  <span className="text-[11px] text-faint hidden sm:inline">{blurb}</span>
                  <span className="ml-auto text-[11px] text-muted">
                    {picked
                      ? <>Picked · <span className={TELEMETRY}>£{picked.price.toFixed(2)}</span></>
                      : `${shown.length} option${shown.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {shown.length === 0 ? (
                  <p className="text-xs text-muted">
                    Nothing matches here. <button onClick={clearAll} className="text-accent hover:underline">Clear filters</button>
                  </p>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {shown.map((p) => {
                      const isSelected = picked?.id === p.id
                      return (
                        <PeripheralCard
                          key={p.id}
                          p={p}
                          isSelected={isSelected}
                          onToggle={() => (isSelected ? removePeripheral(id) : addPeripheral(id, p))}
                        />
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      {filterOpen && (
        <PeripheralFilterPanel
          initial={filters}
          options={filterOptions}
          onApply={(next) => { setFilters(next); setFilterOpen(false) }}
          onCancel={() => setFilterOpen(false)}
        />
      )}
    </div>
  )
}
