export default function DynamicBars({ value, max, label, unit, compact = false }) {
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

  // `compact` is the phone shape: same meter, no minimum width and smaller type,
  // so two of them fit a 375px row instead of being hidden entirely.
  return (
    <div className={`flex flex-col ${compact ? 'gap-0.5 flex-1 min-w-0' : 'gap-1 min-w-[140px]'}`}>
      <div className={`flex justify-between gap-2 text-muted ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <span>{label}</span>
        <span className="font-mono tabular-nums text-ink truncate">{display}</span>
      </div>
      <div className={`bg-surface-2 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
