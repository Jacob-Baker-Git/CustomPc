export default function DynamicBars({ value, max, label, unit }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const barColor =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-blue-500'

  const display = unit === '£'
    ? `£${value.toFixed(0)} / £${max.toFixed(0)}`
    : `${value}${unit} / ${max}${unit}`

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{display}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
