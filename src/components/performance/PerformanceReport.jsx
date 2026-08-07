import FpsCardGrid from './FpsCardGrid'
import { FPS_CAVEAT } from '../../lib/siteContent'

export default function PerformanceReport({ report }) {
  if (!report) return null
  const { coverage } = report
  const nothingCovered = coverage.gamesAnswered === 0

  return (
    <section className="mt-3 rounded-xl border border-line bg-surface-2 p-3.5">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm text-ink">Performance test</h3>
        <span className="text-[11px] text-muted">
          {report.resolution} · {report.presetId}
        </span>
      </header>

      {nothingCovered ? (
        <p className="text-xs leading-relaxed text-muted">
          No benchmark data for these parts yet. The engine only reports figures it
          can trace to a published measurement, so rather than estimate around the
          gap it says nothing. Coverage grows as the benchmark corpus does.
        </p>
      ) : (
        <FpsCardGrid rows={report.games} />
      )}

      {/* text-muted, not text-faint: faint fails WCAG AA for body text, and a
          caveat nobody can read is not a caveat. Same rule as every other piece
          of legal copy in the app. */}
      <footer className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-muted">
        <p>
          {coverage.gamesAnswered} of {coverage.gamesTotal} games estimated
          {coverage.gamesExact > 0 && `, ${coverage.gamesExact} measured directly`} ·
          {' '}model {report.modelVersion} · data as of {report.datasetVersion}
        </p>
        <p className="mt-1">{FPS_CAVEAT}</p>
      </footer>
    </section>
  )
}
