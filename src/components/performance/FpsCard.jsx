import { useState } from 'react'
import { BASIS_LABEL, CAVEAT_TEXT } from './basisText'

// One game's result.
//
// A row with no data shows that fact rather than being dropped: a game silently
// missing from the list reads as a bug, and a game showing an invented number
// is worse than either.
//
// BASIS_LABEL and CAVEAT_TEXT moved to ./basisText so the grouped frame-rate
// table can render the same tiers without a second copy of the wording.

export default function FpsCard({ row }) {
  // Declared before the early return below, not after: a Hook called only on
  // some renders (skipped whenever a row is basis 'none') breaks React's rule
  // that Hooks run in the same order every render — harmless while nothing
  // toggles a mounted card between 'none' and answered, but a landmine for
  // whoever removes that assumption later. Costs nothing to avoid now.
  const [showWhy, setShowWhy] = useState(false)
  const isUpper = row.bound === 'upper'

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
          <div className="font-mono text-2xl leading-none text-ink">
            {isUpper && <span className="mr-1 font-sans text-sm text-muted">up to</span>}
            {row.avgFps}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">average</div>
        </div>
        <div>
          <div className="font-mono text-2xl leading-none text-ink">{row.lowFps ?? '—'}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">1% low</div>
        </div>
        <div className="ml-auto text-right">
          {/* EVERY tier is labelled, not just the good one. Badging only
              `measured` left a modelled number sitting bare on the card — no
              worse-looking than a measured one, and directly beside a list
              headed "no benchmark data yet". Answering in tiers is the whole
              point of the engine, so an unlabelled tier collapses it. */}
          <div className={`text-[10px] uppercase tracking-wider ${
            row.basis === 'measured' ? 'text-good' : 'text-muted'}`}
          >
            {BASIS_LABEL[row.basis] ?? row.basis}
            {row.errorPct != null && ` ±${Math.round(row.errorPct)}%`}
          </div>
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

      {row.caveats?.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            aria-expanded={showWhy}
            className="text-[10px] uppercase tracking-wider text-muted underline decoration-dotted"
          >
            {showWhy ? 'Hide why' : 'Why?'}
          </button>
          {showWhy && (
            <ul className="mt-1.5 space-y-1">
              {row.caveats.map((c) => (
                <li key={c} className="text-[11px] leading-snug text-muted">{CAVEAT_TEXT[c] ?? c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
