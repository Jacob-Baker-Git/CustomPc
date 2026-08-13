import { useState } from 'react'
import { basisMix } from '../../lib/perfEngine/rowBasis'

// What the numbers below are worth, and a way to see only the solid ones.
//
// Separate from SummaryStrip on purpose: that strip answers "how fast, held back
// by what, drawing what". This answers "how much of that did anybody measure",
// which is a different question and deserves its own row.
export default function BasisBar({ rows = [], realOnly, onRealOnlyChange }) {
  const [showHelp, setShowHelp] = useState(false)

  // ⚠️ Counted from the UNFILTERED rows, always. If these totals moved when the
  // filter went on, the control could be used to make a thin evidence base look
  // solid — the exact failure this whole feature exists to prevent.
  const mix = basisMix(rows)
  if (mix.measured + mix.modelled + mix.estimated === 0) return null

  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[11px] text-muted">
          <span className="text-good">{mix.measured} benchmarked</span>
          {' · '}{mix.modelled} backed by real data
          {' · '}{mix.estimated} estimated
        </p>

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="text-[11px] text-muted underline decoration-dotted"
        >
          How is this worked out?
        </button>

        <label className="ml-auto flex items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={realOnly}
            onChange={(e) => onRealOnlyChange(e.target.checked)}
            className="accent-accent"
          />
          Only show real data
        </label>
      </div>

      {showHelp && (
        <dl className="mt-2.5 space-y-1.5 border-t border-line pt-2.5 text-[11px] leading-snug text-muted">
          <div><dt className="inline text-ink">Benchmarked</dt>{' — '}
            <dd className="inline">a reviewer ran this exact processor, graphics card, game and settings.</dd></div>
          <div><dt className="inline text-ink">Backed by real data</dt>{' — '}
            <dd className="inline">worked out from benchmarks of both parts in this game, rather than of this pairing.</dd></div>
          <div><dt className="inline text-ink">Estimate</dt>{' — '}
            <dd className="inline">no review has charted one of these parts, so its speed is inferred from the
              specifications. The inference is checked by predicting parts that were held out of it, and the
              typical error of that check is the ± figure on the row.</dd></div>
          <div><dt className="inline text-ink">Up to</dt>{' — '}
            <dd className="inline">no review has measured processor performance in this game, so the figure is
              the graphics card’s ceiling and the real number may be lower.</dd></div>
        </dl>
      )}
    </div>
  )
}
