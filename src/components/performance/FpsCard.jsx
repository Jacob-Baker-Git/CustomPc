// One game's result.
//
// A row with no data shows that fact rather than being dropped: a game silently
// missing from the list reads as a bug, and a game showing an invented number
// is worse than either.
export default function FpsCard({ row }) {
  if (row.basis === 'none') {
    return (
      <div className="rounded-lg border border-line bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-ink">{row.name}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted">{row.preset}</span>
        </div>
        <p className="mt-2 text-[11px] text-muted">No benchmark data yet</p>
      </div>
    )
  }

  // A measurement is a duration, not an attribution of it — so a row can have
  // a frame rate and no split, when the corpus measured this exact combination
  // but never fitted the cell that would divide the frame. `1 - null` is 1 in
  // JavaScript, so drawing the bar anyway shows a full GPU bar labelled
  // "Balanced": two contradictory claims, neither of them measured.
  const splitKnown = row.cpuShare != null && row.limitedBy != null
  const gpuPct = splitKnown ? Math.round((1 - row.cpuShare) * 100) : 0
  const label = row.limitedBy === 'cpu' ? 'CPU-led'
    : row.limitedBy === 'gpu' ? 'GPU-led' : 'Balanced'

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink">{row.name}</span>
        <span className="text-[11px] uppercase tracking-wider text-muted">{row.preset}</span>
      </div>

      {/* Average and 1% low at EQUAL weight. The gap between them is the most
          useful thing on the card — 120/95 and 120/48 are completely different
          machines to sit in front of, and only the second number says so.
          Quoting the average alone is how frame-rate figures usually mislead. */}
      <div className="mt-2 flex items-end gap-4">
        <div>
          <div className="font-mono text-2xl leading-none text-ink">{row.avgFps}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">average</div>
        </div>
        <div>
          <div className="font-mono text-2xl leading-none text-ink">{row.lowFps ?? '—'}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">1% low</div>
        </div>
        <div className="ml-auto text-right">
          {row.basis === 'measured' && (
            <div className="text-[10px] uppercase tracking-wider text-good">measured</div>
          )}
          {row.atEngineCap && (
            <div className="text-[10px] text-muted">engine cap</div>
          )}
          <div className="font-mono text-[10px] text-muted">{row.frameTimeMs} ms</div>
        </div>
      </div>

      {/* The split is stated in words as well as drawn: a bar alone is
          unreadable to a screen reader and to anyone colour-blind. */}
      {splitKnown ? (
        <div className="mt-2.5 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={`${gpuPct}% of the frame is GPU work — ${label}`}
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${gpuPct}%` }} />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
        </div>
      ) : (
        <p className="mt-2.5 text-[10px] uppercase tracking-wider text-muted">
          Split not modelled
        </p>
      )}
    </div>
  )
}
