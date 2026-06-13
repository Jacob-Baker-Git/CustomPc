export default function PartCard({ part, locked, lockReason, onSelect }) {
  return (
    <div
      title={locked ? lockReason : undefined}
      onClick={() => !locked && onSelect(part)}
      className={`relative rounded-xl border p-4 flex flex-col gap-2 transition-all
        ${locked
          ? 'border-gray-700 bg-gray-800/40 opacity-40 cursor-not-allowed'
          : 'border-gray-700 bg-gray-800 hover:border-blue-500 cursor-pointer'
        }`}
    >
      <div className="text-sm font-semibold text-white leading-tight">{part.name}</div>
      <div className="text-blue-400 font-bold">£{part.price.toFixed(2)}</div>
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
