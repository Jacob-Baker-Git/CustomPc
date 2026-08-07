import { useMemo, useState } from 'react'
import { estimateBuildPerformance } from '../lib/perfEngine'
import PerformanceReport from './performance/PerformanceReport'

// The click reveals a result that is already computed — there is no spinner and
// no simulated delay. The calculation takes single-digit milliseconds, and
// faking latency in a feature whose entire selling point is honesty would be
// theatre. If the dataset ever makes it genuinely slow, the fix is a real async
// boundary, not a pretend one.
export default function RunPerformanceTest({
  parts, resolution, model, games, presetId = 'high',
}) {
  const [open, setOpen] = useState(false)
  const ready = Boolean(parts?.cpu && parts?.gpu)

  const report = useMemo(
    () => (ready && open
      ? estimateBuildPerformance({ parts, resolution, presetId, model, games })
      : null),
    [ready, open, parts, resolution, presetId, model, games],
  )

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={!ready}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:border-accent disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-line"
      >
        {open ? 'Hide performance test' : 'Run performance test'}
      </button>

      {!ready && (
        <p className="mt-1.5 text-[11px] text-muted">
          Pick a CPU and a graphics card to run a performance test.
        </p>
      )}

      {open && <PerformanceReport report={report} />}
    </div>
  )
}
