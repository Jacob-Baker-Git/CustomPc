import { useMemo, useState } from 'react'
import { Monitor, Keyboard, Mouse, Headphones, Check } from 'lucide-react'
import useBuilderStore, { selPeripheralsTotal } from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import SpecSheet from './SpecSheet'
import { PANEL, TELEMETRY } from '../lib/uiTokens'

const CATEGORIES = [
  { id: 'monitor',  label: 'Monitor',  icon: Monitor,    blurb: 'The one part you actually look at' },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard,   blurb: 'Membrane is fine; mechanical lasts' },
  { id: 'mouse',    label: 'Mouse',    icon: Mouse,      blurb: 'Shape matters more than DPI' },
  { id: 'headset',  label: 'Headset',  icon: Headphones, blurb: 'Wired sounds better per pound' },
]

// Bands are read off the catalogue itself rather than hardcoded, so adding a
// cheaper or dearer item re-sorts the tiers instead of stranding it.
const BANDS = [
  { id: 'all',   label: 'All' },
  { id: 'value', label: 'Value' },
  { id: 'mid',   label: 'Mid' },
  { id: 'high',  label: 'High-end' },
]

function bandOf(price, thirds) {
  if (price <= thirds[0]) return 'value'
  if (price <= thirds[1]) return 'mid'
  return 'high'
}

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
  const [band, setBand]  = useState('all')

  const byCategory = useMemo(() => {
    const map = {}
    for (const { id } of CATEGORIES) {
      const all = peripheralsData.filter((p) => p.category === id).sort((a, b) => a.price - b.price)
      const prices = all.map((p) => p.price)
      const thirds = [
        prices[Math.floor(prices.length / 3)] ?? Infinity,
        prices[Math.floor((2 * prices.length) / 3)] ?? Infinity,
      ]
      map[id] = { all, thirds }
    }
    return map
  }, [peripheralsData])

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

        {/* One filter for the whole page. The catalogue now runs from a £10 mouse
            to a £1000 monitor, which is unreadable as a single flat grid. */}
        <div role="radiogroup" aria-label="Price band" className="flex flex-wrap gap-1.5 mb-6">
          {BANDS.map((b) => {
            const on = b.id === band
            return (
              <button
                key={b.id}
                role="radio"
                aria-checked={on}
                onClick={() => setBand(b.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95
                  ${on
                    ? 'chip-pick border-accent bg-accent text-accent-ink'
                    : 'border-line bg-surface text-muted hover:text-ink hover:border-line-strong'}`}
              >
                {b.label}
              </button>
            )
          })}
        </div>

        <div className="space-y-8">
          {CATEGORIES.map(({ id, label, icon: Icon, blurb }) => {
            const { all, thirds } = byCategory[id] ?? { all: [], thirds: [Infinity, Infinity] }
            const shown = band === 'all' ? all : all.filter((p) => bandOf(p.price, thirds) === band)
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
                  <p className="text-xs text-faint">Nothing in this price band.</p>
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
    </div>
  )
}
