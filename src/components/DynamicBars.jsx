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

  // Full size is a bordered chip so the meter groups with the tab control beside
  // it instead of trailing off as a stray hairline. `compact` is the phone
  // shape: no chrome, no minimum width, smaller type, so two fit a 375px row.
  return (
    <div
      className={
        compact
          ? 'flex flex-col gap-0.5 flex-1 min-w-0'
          : 'flex flex-col gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 min-w-[136px]'
      }
    >
      <div className={`flex items-baseline justify-between gap-2 ${compact ? 'text-[10px] text-muted' : 'text-[10px]'}`}>
        <span className={compact ? '' : 'uppercase tracking-wide text-faint'}>{label}</span>
        <span className={`font-mono tabular-nums truncate ${compact ? 'text-ink' : 'text-[11px] text-ink'}`}>{display}</span>
      </div>
      <div className={`rounded-full overflow-hidden ${compact ? 'h-1.5 bg-surface-2' : 'h-1.5 bg-ground'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
