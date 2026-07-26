import useBuilderStore from '../store/useBuilderStore'
import { getBuildWarnings } from '../lib/buildWarnings'
import { PANEL } from '../lib/uiTokens'

export default function BuildWarnings() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const warnings = getBuildWarnings(selectedParts)
  if (warnings.length === 0) return null

  return (
    <div className={`${PANEL} p-4`}>
      <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Build checks</div>
      <ul className="space-y-1.5">
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted">
            <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${w.level === 'critical' ? 'bg-bad' : 'bg-ok'}`} />
            <span>{w.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
