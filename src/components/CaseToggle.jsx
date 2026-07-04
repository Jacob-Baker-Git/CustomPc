import { Eye, Box } from 'lucide-react'
import useBuilderStore from '../store/useBuilderStore'

export default function CaseToggle() {
  const transparent = useBuilderStore((s) => s.caseTransparent)
  const toggle      = useBuilderStore((s) => s.toggleCaseTransparency)
  const hasCase     = useBuilderStore((s) => Boolean(s.selectedParts.case))

  if (!hasCase) return null

  return (
    <button
      onClick={toggle}
      className="bg-slate-950/30 backdrop-blur-md hover:border-cyan-400/60 text-slate-100 text-sm px-4 py-2 rounded-sm border border-slate-800/60 transition-colors flex items-center gap-2"
    >
      {transparent
        ? <><Box size={14} aria-hidden="true" /> Solid case</>
        : <><Eye size={14} aria-hidden="true" /> See-through case</>}
    </button>
  )
}
