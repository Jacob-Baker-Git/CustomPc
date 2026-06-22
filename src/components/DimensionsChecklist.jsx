import useBuilderStore from '../store/useBuilderStore'
import { dimensionsCheck } from '../lib/dimensionsCheck'

const ICON = { pass: '✓', fail: '!', na: '·' }
const COLOR = {
  pass: 'text-emerald-300 border-emerald-400/40',
  fail: 'text-red-400 border-red-400/40',
  na: 'text-slate-500 border-slate-700/60',
}

export default function DimensionsChecklist() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const rows = dimensionsCheck(selectedParts)
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 py-1.5 border-t border-slate-800/50">
          <span className={`w-4 h-4 shrink-0 flex items-center justify-center rounded-sm border text-[10px] font-mono ${COLOR[r.status]}`}>{ICON[r.status]}</span>
          <span className="flex-1 text-sm text-slate-200">{r.label}</span>
          <span className="text-[11px] text-slate-500 font-mono">{r.detail}</span>
        </div>
      ))}
    </div>
  )
}
