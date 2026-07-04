import { useMemo } from 'react'
import useBuilderStore, { selPeripheralsTotal } from '../store/useBuilderStore'
import peripheralsData from '../data/peripheralsData.json'

const CATEGORIES = ['monitor', 'keyboard', 'mouse', 'headset']

function specLine(p) {
  if (p.category === 'monitor') return `${p.resolution} · ${p.refresh}Hz`
  if (p.category === 'keyboard') return `${p.switch} switches`
  if (p.category === 'mouse') return `${p.dpi} DPI`
  if (p.category === 'headset') return p.type
  return ''
}

export default function PeripheralsPanel() {
  const selected         = useBuilderStore((s) => s.selectedPeripherals)
  const addPeripheral    = useBuilderStore((s) => s.addPeripheral)
  const removePeripheral = useBuilderStore((s) => s.removePeripheral)
  const total            = useBuilderStore(selPeripheralsTotal)

  const byCategory = useMemo(() => {
    const map = {}
    for (const cat of CATEGORIES) map[cat] = peripheralsData.filter((p) => p.category === cat)
    return map
  }, [])

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold text-white">Peripherals</h2>
        <span className="text-sm text-gray-300">Subtotal: <span className="text-cyan-300 font-semibold">£{total.toFixed(2)}</span></span>
      </div>
      <div className="max-w-5xl mx-auto space-y-8">
        {CATEGORIES.map((cat) => (
          <section key={cat}>
            <h3 className="text-sm font-semibold text-gray-300 capitalize mb-3">{cat}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {byCategory[cat].map((p) => {
                const isSelected = selected[cat]?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => (isSelected ? removePeripheral(cat) : addPeripheral(cat, p))}
                    title={isSelected ? 'Click to deselect' : 'Click to select'}
                    className={`relative text-left rounded-sm border p-4 transition-all
                      ${isSelected
                        ? 'border-cyan-400/60 bg-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:border-cyan-400/40 hover:-translate-y-0.5'}`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 text-cyan-300 text-xs">✓ selected</span>
                    )}
                    <div className="text-sm font-semibold text-white leading-tight pr-16">{p.name}</div>
                    <div className="font-bold text-cyan-300 mt-1">£{p.price.toFixed(2)}</div>
                    <div className="text-xs text-gray-400 mt-1">{specLine(p)}</div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
