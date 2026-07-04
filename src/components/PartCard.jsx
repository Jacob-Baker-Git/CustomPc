import { valuePerPound } from '../lib/valueScore'

export default function PartCard({ part, locked, lockReason, selected = false, onSelect }) {
  return (
    <button
      type="button"
      title={locked ? lockReason : undefined}
      aria-disabled={locked || undefined}
      onClick={() => !locked && onSelect(part)}
      className={`relative rounded-sm border p-4 flex flex-col gap-2 text-left transition-all
        ${locked
          ? 'border-white/5 bg-white/5 opacity-60 cursor-not-allowed'
          : selected
            ? 'border-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-400/50 cursor-pointer'
            : 'border-white/10 bg-white/5 hover:border-cyan-400/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(34,211,238,0.25)] focus-visible:border-cyan-400/60 cursor-pointer'
        }`}
    >
      <div className="text-sm font-semibold text-white leading-tight">{part.name}</div>
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
      {locked && lockReason && (
        <div className="text-[11px] text-red-300 leading-snug">{lockReason}</div>
      )}
      {locked && <div className="absolute top-2 right-2 text-red-400 text-xs">🔒</div>}
      {selected && !locked && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-cyan-300 border border-cyan-400/60 rounded-sm px-1.5 py-0.5">
          Selected
        </div>
      )}
    </button>
  )
}
