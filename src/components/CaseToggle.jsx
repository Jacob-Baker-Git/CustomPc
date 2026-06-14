import useBuilderStore from '../store/useBuilderStore'

export default function CaseToggle() {
  const transparent = useBuilderStore((s) => s.caseTransparent)
  const toggle      = useBuilderStore((s) => s.toggleCaseTransparency)
  const hasCase     = useBuilderStore((s) => Boolean(s.selectedParts.case))

  if (!hasCase) return null

  return (
    <button
      onClick={toggle}
      className="absolute bottom-6 right-6 bg-gray-900/70 backdrop-blur-md hover:border-cyan-400/60 text-white text-sm px-4 py-2 rounded-full border border-white/10 transition-all flex items-center gap-2"
    >
      <span>{transparent ? '👁️ See-through case' : '📦 Solid case'}</span>
    </button>
  )
}
