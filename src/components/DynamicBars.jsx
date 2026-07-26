export default function DynamicBars({ value, max, label, unit }) {
  const hasMax = typeof max === 'number' && max > 0
  const pct = hasMax ? Math.min((value / max) * 100, 100) : 0
  const barColor =
    pct >= 100 ? 'bg-bad'
    : pct >= 80 ? 'bg-ok'
    : 'bg-accent'

  // Until a capacity is known (e.g. no PSU selected yet) show only the live draw,
  // not a misleading "0 / 750" against a default that isn't really there.
  const display = !hasMax
    ? `${value}${unit}`
    : unit === '£'
      ? `£${value.toFixed(0)} / £${max.toFixed(0)}`
      : `${value}${unit} / ${max}${unit}`

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-ink">{display}</span>
      </div>
      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
