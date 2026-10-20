import { useMemo, useState } from 'react'
import { Monitor, Keyboard, Mouse, Headphones, Check, SlidersHorizontal } from 'lucide-react'
import useBuilderStore, { selPeripheralsTotal } from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import SpecSheet from './SpecSheet'
import PeripheralFilterPanel from './PeripheralFilterPanel'
import { TELEMETRY } from '../lib/uiTokens'
import Block from './ui/Block'
import Tag from './ui/Tag'
import { gbp, gbp2 } from '../lib/money'
import {
  filterPeripherals, specValues, SORTS, DEFAULT_SORT,
  brandValues, refreshBandsFor, toFilterOptions,
  EMPTY_FILTERS, activeFilterCount, firstFew,
} from '../lib/peripheralFilter'

const CATEGORIES = [
  { id: 'monitor',  label: 'Monitor',  plural: 'monitors', icon: Monitor,    blurb: 'The one part you actually look at' },
  { id: 'keyboard', label: 'Keyboard', plural: 'keyboards', icon: Keyboard,   blurb: 'Membrane is fine; mechanical lasts' },
  { id: 'mouse',    label: 'Mouse',    plural: 'mice', icon: Mouse,      blurb: 'Shape matters more than DPI' },
  { id: 'headset',  label: 'Headset',  plural: 'headsets', icon: Headphones, blurb: 'Wired sounds better per pound' },
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
      className={`relative flex flex-col gap-2 border-t py-3 transition-colors
        ${isSelected ? 'border-gold' : 'border-line'}`}
    >
      {isSelected && (
        <span className="absolute top-2 right-2 flex items-center gap-1 text-gold text-[12px] font-semibold">
          <Check size={11} aria-hidden="true" /> Picked
        </span>
      )}
      <button
        type="button"
        onClick={onToggle}
        title={isSelected ? 'Click to deselect' : 'Click to select'}
        className="text-left flex flex-col cursor-pointer focus-visible:outline-brass"
      >
        <div className="text-sm font-semibold text-ink leading-tight pr-14">{p.name}</div>
        <div className={`${TELEMETRY} font-bold text-tech mt-1`}>{gbp2(p.price)}</div>
        <div className="text-xs text-muted mt-1">{specLine(p)}</div>
      </button>
      <button
        type="button"
        aria-label={`More info about ${p.name}`}
        aria-expanded={showInfo}
        onClick={() => setShowInfo((v) => !v)}
        className="self-start min-h-6 text-[12px] text-muted hover:text-brass border border-line hover:border-brass rounded-lg px-2 py-0.5 transition-colors"
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
  // Which categories the reader asked to see in full. Each shows its first four
  // until then (spec 2026-10-16); a search, filter or re-sort lifts the cap.
  const [expanded, setExpanded] = useState({})

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
      <div className="max-w-5xl mx-auto lg:max-w-6xl">
        {/* A running total and a progress line, so the tab says how far along you
            are rather than just listing four unrelated grids. */}
        <Block
          className="mb-6 border-t-0 pt-0"
          title="Peripherals"
          aside={<Tag><b>{pickedCount}</b> of {CATEGORIES.length} chosen · {gbp(total)}</Tag>}
        >
          <p className="text-[13px] text-muted">Optional, and counted apart from the build budget.</p>
        </Block>

        {/* Search and sort apply across all four groups — with ~120 items and no
            way to look one up, price bands alone were doing too much work. */}
        <div className="flex flex-wrap gap-2 items-center mb-6">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search peripherals…"
            aria-label="Search peripherals by name or brand"
            className="flex-1 min-w-48 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-hidden focus:border-brass"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort peripherals"
            className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-hidden focus:border-brass"
          >
            {Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-haspopup="dialog"
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors
              ${filterCount > 0
                ? 'border-gold text-gold bg-gold-soft'
                : 'border-line text-muted bg-surface hover:text-ink hover:border-line-strong'}`}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            Filters
            {filterCount > 0 && (
              <span className={`${TELEMETRY} rounded-full bg-gold text-accent-ink px-1.5 text-[12px] font-bold`}>
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
          {CATEGORIES.map(({ id, label, plural, icon: Icon, blurb }) => {
            const { all } = byCategory[id] ?? { all: [] }
            // Price bands and the single spec chip row used to live inline here,
            // one set per category. They are in the Filters panel now — four
            // stacked chip rows pushed the actual products below the fold, and
            // multi-select does not fit a radiogroup.
            const shown = filterPeripherals(all, toFilterOptions(id, filters, { query, sort }))
            const picked = selected[id]
            const { visible, hidden } = firstFew(shown, { pickedId: picked?.id, capped: !anyFilter && !expanded[id] })
            return (
              <section key={id}>
                <div className="mb-1 flex items-baseline gap-2 pt-2">
                  <Icon size={15} className="text-brass shrink-0 self-center" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">{label}</h3>
                  <span className="text-[12px] text-faint hidden sm:inline">{blurb}</span>
                  <span className="ml-auto text-[12px] text-muted">
                    {picked
                      ? <>Picked · <span className={TELEMETRY}>{gbp2(picked.price)}</span></>
                      : `${shown.length} option${shown.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {shown.length === 0 ? (
                  <p className="text-xs text-muted">
                    Nothing matches here. <button onClick={clearAll} className="text-brass hover:underline">Clear filters</button>
                  </p>
                ) : (
                  <>
                  <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 lg:grid-cols-4">
                    {visible.map((p) => {
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
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [id]: true }))}
                      className="mt-2 min-h-11 text-sm font-semibold text-brass hover:underline"
                    >
                      Show all {shown.length} {plural}
                    </button>
                  )}
                  </>
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
