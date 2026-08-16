// Shared "Info" spec sheet used by hardware part cards and peripheral cards.
// The derived copy and the spec table live in lib/specSheetContent.js.
import { insight, gpuResChips, specRows } from '../lib/specSheetContent'
import { derivedStats } from '../lib/partStats'

export default function SpecSheet({ part }) {
  const note = insight(part)
  // Computed metrics only — value per pound, efficiency, cooling capacity.
  // specRows already prints every raw field, so nothing appears twice.
  const derived = derivedStats(part)
  return (
    <div className="border-t border-line pt-2 mt-1">
      {note && <p className="text-[11px] leading-relaxed text-muted mb-2">{note}</p>}
      {part.category === 'gpu' && part.perfScore > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {gpuResChips(part).map(({ res, fps }) => (
            <span key={res} className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-line text-muted">
              ~{fps} fps @ {res.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
      {derived.length > 0 && (
        <dl className="text-[11px] leading-relaxed grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mb-2 pb-2 border-b border-line">
          {derived.map(({ label, value, unit, hint }) => (
            <div key={label} className="contents">
              <dt className="text-muted" title={hint || undefined}>{label}</dt>
              <dd className="text-tech text-right font-mono tabular-nums">{value}{unit}</dd>
            </div>
          ))}
        </dl>
      )}
      <dl className="text-[11px] leading-relaxed grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {specRows(part).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-ink text-right font-mono tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
