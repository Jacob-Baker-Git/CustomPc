import { useState } from 'react'
import { Lock } from 'lucide-react'
import { valuePerPound } from '../lib/valueScore'
import SpecSheet from './SpecSheet'

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
      {showInfo && <SpecSheet part={part} />}
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
