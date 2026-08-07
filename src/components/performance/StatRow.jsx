// One labelled figure. The unit is separated from the number so the numbers
// line up down a column and the eye can scan them, and every value is real
// text — a stats page whose figures only exist inside a chart is unreadable to
// a screen reader and unsearchable to everyone.
export default function StatRow({ label, value, unit, hint, tone = 'ink' }) {
  const shown = value == null || value === '' ? '—' : value
  const toneClass = tone === 'good' ? 'text-good'
    : tone === 'ok' ? 'text-ok'
      : tone === 'bad' ? 'text-bad' : 'text-ink'

  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-t border-line first:border-t-0">
      <span className="text-xs text-muted">
        {label}
        {hint && <span className="block text-[10px] text-muted/80 leading-tight">{hint}</span>}
      </span>
      <span className="shrink-0 font-mono text-sm tabular-nums">
        <span className={toneClass}>{shown}</span>
        {unit && shown !== '—' && <span className="ml-1 text-[10px] text-muted">{unit}</span>}
      </span>
    </div>
  )
}
