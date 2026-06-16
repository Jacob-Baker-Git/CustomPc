export default function DynamicBars({ value, max, label, unit }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const barColor =
    pct >= 100 ? 'bg-gradient-to-r from-red-500 to-rose-500'
    : pct >= 80 ? 'bg-gradient-to-r from-amber-400 to-orange-500'
    : 'bg-gradient-to-r from-cyan-400 to-blue-500'

  const display = unit === '£'
    ? `£${value.toFixed(0)} / £${max.toFixed(0)}`
    : `${value}${unit} / ${max}${unit}`

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-mono text-gray-300">{display}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-sm overflow-hidden">
        <div
          className={`h-full rounded-sm transition-all duration-500 ${barColor} shadow-[0_0_10px_rgba(34,211,238,0.4)]`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
