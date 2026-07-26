import { useMemo, useState } from 'react'
import useBuilderStore, { selPeripheralsTotal } from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import SpecSheet from './SpecSheet'

const CATEGORIES = ['monitor', 'keyboard', 'mouse', 'headset']

function specLine(p) {
  if (p.category === 'monitor') return `${p.resolution} · ${p.refresh}Hz`
  if (p.category === 'keyboard') return `${p.switch} switches`
  if (p.category === 'mouse') return `${p.dpi} DPI`
  if (p.category === 'headset') return p.type
  return ''
}

function PeripheralCard({ p, isSelected, onToggle }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div
      className={`relative rounded-xl border p-4 flex flex-col gap-2 transition-all
        ${isSelected
          ? 'border-accent bg-accent-soft'
          : 'border-line bg-surface hover:border-accent hover:-translate-y-0.5'}`}
    >
      {isSelected && (
        <span className="absolute top-2 right-2 text-accent text-xs">✓ selected</span>
      )}
      <button
        type="button"
        onClick={onToggle}
        title={isSelected ? 'Click to deselect' : 'Click to select'}
        className="text-left flex flex-col cursor-pointer focus-visible:outline-accent"
      >
        <div className="text-sm font-semibold text-ink leading-tight pr-16">{p.name}</div>
        <div className="font-mono tabular-nums font-bold text-accent mt-1">£{p.price.toFixed(2)}</div>
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

  const byCategory = useMemo(() => {
    const map = {}
    for (const cat of CATEGORIES) map[cat] = peripheralsData.filter((p) => p.category === cat)
    return map
  }, [peripheralsData])

  return (
    <div className="w-full p-6 pb-12">
      <div className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <h2 className="font-display text-xl font-bold text-ink">Peripherals</h2>
        <span className="text-sm text-muted">Subtotal: <span className="text-accent font-semibold">£{total.toFixed(2)}</span></span>
      </div>
      <div className="max-w-5xl mx-auto space-y-8">
        {CATEGORIES.map((cat) => (
          <section key={cat}>
            <h3 className="text-sm font-semibold text-muted capitalize mb-3">{cat}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {byCategory[cat].map((p) => {
                const isSelected = selected[cat]?.id === p.id
                return (
                  <PeripheralCard
                    key={p.id}
                    p={p}
                    isSelected={isSelected}
                    onToggle={() => (isSelected ? removePeripheral(cat) : addPeripheral(cat, p))}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
