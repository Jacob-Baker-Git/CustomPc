import { useState } from 'react'
import { Lock } from 'lucide-react'
import { valuePerPound } from '../lib/valueScore'

const SPEC_LABELS = {
  cores: 'Cores',
  threads: 'Threads',
  boostClock: 'Boost clock (GHz)',
  baseClock: 'Base clock (GHz)',
  vramGb: 'VRAM (GB)',
  speedMhz: 'Speed (MHz)',
  readMbps: 'Read speed (MB/s)',
  writeMbps: 'Write speed (MB/s)',
  sizeMm: 'Fan size (mm)',
  pack: 'Fans in pack',
  rpm: 'Max RPM',
  efficiency: 'Efficiency',
  modular: 'Modular',
  formFactor: 'Form factor',
  chipset: 'Chipset',
  type: 'Type',
}

const humanize = (key) =>
  SPEC_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

function specRows(part) {
  const rows = []
  if (part.brand) rows.push(['Brand', part.brand])
  if (part.socket) rows.push(['Socket', part.socket])
  if (part.ramType) rows.push(['RAM type', part.ramType])
  if (part.tdp > 0) rows.push(['Power draw (TDP)', `${part.tdp}W`])
  if (part.wattage) rows.push(['Wattage', `${part.wattage}W`])
  if (part.capacityGb) {
    rows.push(['Capacity', part.capacityGb >= 1000 ? `${part.capacityGb / 1000}TB` : `${part.capacityGb}GB`])
  }
  if (part.length) rows.push(['Card length', `${part.length}mm`])
  if (part.height) rows.push(['Cooler height', `${part.height}mm`])
  if (part.maxGpuLength) rows.push(['Max GPU length', `${part.maxGpuLength}mm`])
  if (part.maxCoolerHeight) rows.push(['Max cooler height', `${part.maxCoolerHeight}mm`])
  for (const [k, v] of Object.entries(part.specs ?? {})) {
    rows.push([humanize(k), typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)])
  }
  if (part.perfScore > 0) rows.push(['Performance score', String(part.perfScore)])
  return rows
}

export default function PartCard({ part, locked, lockReason, selected = false, onSelect }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div
      className={`relative rounded-sm border p-4 flex flex-col gap-2 transition-all
        ${locked
          ? 'border-white/5 bg-white/5 opacity-60'
          : selected
            ? 'border-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-400/50'
            : 'border-white/10 bg-white/5 hover:border-cyan-400/60 hover:-translate-y-0.5'
        }`}
    >
      <button
        type="button"
        title={locked ? lockReason : undefined}
        aria-disabled={locked || undefined}
        onClick={() => !locked && onSelect(part)}
        className={`text-left flex flex-col gap-2 focus-visible:outline-cyan-400 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="text-sm font-semibold text-white leading-tight pr-6">{part.name}</div>
        <div className="font-mono font-bold text-cyan-300">£{part.price.toFixed(2)}</div>
        <div className="text-xs text-gray-400 space-y-0.5">
          {part.tdp > 0 && <div>{part.tdp}W TDP</div>}
          {part.socket && <div>Socket: {part.socket}</div>}
          {part.ramType && <div>{part.ramType}</div>}
          {part.wattage && <div>{part.wattage}W</div>}
          {part.capacityGb && (
            <div>{part.capacityGb >= 1000 ? `${part.capacityGb / 1000}TB` : `${part.capacityGb}GB`}</div>
          )}
          {part.perfScore > 0 && (
            <div className="text-cyan-300/80">{valuePerPound(part).toFixed(1)} perf/£100</div>
          )}
        </div>
      </button>
      {locked && lockReason && (
        <div className="text-[11px] text-red-300 leading-snug">{lockReason}</div>
      )}
      <button
        type="button"
        aria-label={`More info about ${part.name}`}
        aria-expanded={showInfo}
        onClick={() => setShowInfo((v) => !v)}
        className="self-start text-[11px] text-slate-400 hover:text-cyan-300 border border-slate-700/70 hover:border-cyan-400/60 rounded-sm px-2 py-0.5 transition-colors"
      >
        {showInfo ? 'Hide info' : 'Info'}
      </button>
      {showInfo && (
        <dl className="text-[11px] leading-relaxed border-t border-white/10 pt-2 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {specRows(part).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-slate-200 text-right font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {locked && (
        <div role="img" aria-label="Locked" className="absolute top-2 right-2 text-red-400">
          <Lock size={12} aria-hidden="true" />
        </div>
      )}
      {selected && !locked && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-cyan-300 border border-cyan-400/60 rounded-sm px-1.5 py-0.5">
          Selected
        </div>
      )}
    </div>
  )
}
