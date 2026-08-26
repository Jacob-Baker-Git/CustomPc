import { useState } from 'react'
import { Lock } from 'lucide-react'
import { valuePerPound } from '../lib/valueScore'
import SpecSheet from './SpecSheet'

export default function PartCard({ part, locked, lockReason, selected = false, onSelect }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div
      className={`relative rounded-xl border p-4 flex flex-col gap-2 transition-all
        ${locked
          ? 'border-line bg-surface-2 opacity-60'
          : selected
            ? 'border-gold bg-gold-soft ring-1 ring-gold'
            : 'border-line bg-surface hover:border-brass hover:-translate-y-0.5'
        }`}
    >
      <button
        type="button"
        title={locked ? lockReason : undefined}
        aria-disabled={locked || undefined}
        onClick={() => !locked && onSelect(part)}
        className={`text-left flex flex-col gap-2 focus-visible:outline-brass ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="text-sm font-semibold text-ink leading-tight pr-6">{part.name}</div>
        <div className="font-mono tabular-nums font-bold text-tech">£{part.price.toFixed(2)}</div>
        <div className="text-xs text-muted space-y-0.5">
          {part.tdp > 0 && <div>{part.tdp}W TDP</div>}
          {part.socket && <div>Socket: {part.socket}</div>}
          {part.ramType && <div>{part.ramType}</div>}
          {part.wattage && <div>{part.wattage}W</div>}
          {part.capacityGb && (
            <div>{part.capacityGb >= 1000 ? `${part.capacityGb / 1000}TB` : `${part.capacityGb}GB`}</div>
          )}
          {part.perfScore > 0 && (
            <div className="text-tech">{valuePerPound(part).toFixed(1)} perf/£100</div>
          )}
        </div>
      </button>
      {locked && lockReason && (
        <div className="text-[11px] text-bad leading-snug">{lockReason}</div>
      )}
      <button
        type="button"
        aria-label={`More info about ${part.name}`}
        aria-expanded={showInfo}
        onClick={() => setShowInfo((v) => !v)}
        className="self-start text-[11px] text-muted hover:text-brass border border-line hover:border-brass rounded-lg px-2 py-0.5 transition-colors"
      >
        {showInfo ? 'Hide info' : 'Info'}
      </button>
      {showInfo && <SpecSheet part={part} />}
      {locked && (
        <div role="img" aria-label="Locked" className="absolute top-2 right-2 text-bad">
          <Lock size={12} aria-hidden="true" />
        </div>
      )}
      {selected && !locked && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-gold border border-gold rounded-md px-1.5 py-0.5">
          Selected
        </div>
      )}
    </div>
  )
}
