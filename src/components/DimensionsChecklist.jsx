import useBuilderStore from '../store/useBuilderStore'
import { dimensionsCheck } from '../lib/dimensionsCheck'

const ICON = { pass: '✓', fail: '!', na: '·' }
const COLOR = {
  pass: 'text-good border-good',
  fail: 'text-bad border-bad',
  na: 'text-muted border-line',
}

export default function DimensionsChecklist() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const rows = dimensionsCheck(selectedParts)
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 py-1.5 border-t border-line">
          <span className={`w-4 h-4 shrink-0 flex items-center justify-center rounded-lg border text-[10px] font-mono ${COLOR[r.status]}`}>{ICON[r.status]}</span>
          <span className="flex-1 text-sm text-ink">{r.label}</span>
          <span className="text-[11px] text-muted font-mono">{r.detail}</span>
        </div>
      ))}
    </div>
  )
}
