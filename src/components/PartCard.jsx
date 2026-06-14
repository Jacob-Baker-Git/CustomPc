export default function PartCard({ part, locked, lockReason, onSelect }) {
  return (
    <div
      title={locked ? lockReason : undefined}
      onClick={() => !locked && onSelect(part)}
      className={`relative rounded-2xl border p-4 flex flex-col gap-2 transition-all
        ${locked
          ? 'border-white/5 bg-white/5 opacity-40 cursor-not-allowed'
          : 'border-white/10 bg-white/5 hover:border-cyan-400/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(34,211,238,0.25)] cursor-pointer'
        }`}
    >
      <div className="text-sm font-semibold text-white leading-tight">{part.name}</div>
      <div className="font-bold text-cyan-300">£{part.price.toFixed(2)}</div>
      <div className="text-xs text-gray-400 space-y-0.5">
        {part.tdp > 0 && <div>{part.tdp}W TDP</div>}
        {part.socket && <div>Socket: {part.socket}</div>}
        {part.ramType && <div>{part.ramType}</div>}
        {part.wattage && <div>{part.wattage}W</div>}
        {part.capacityGb && (
          <div>{part.capacityGb >= 1000 ? `${part.capacityGb / 1000}TB` : `${part.capacityGb}GB`}</div>
        )}
      </div>
      {locked && <div className="absolute top-2 right-2 text-red-400 text-xs">🔒</div>}
    </div>
  )
}
