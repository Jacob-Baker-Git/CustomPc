import useBuilderStore from '../store/useBuilderStore'

const OPTIONS = [
  { id: '1080p', label: '1080p' },
  { id: '1440p', label: '1440p' },
  { id: '4k',    label: '4K' },
]

export default function ResolutionToggle() {
  const resolution    = useBuilderStore((s) => s.resolution)
  const setResolution = useBuilderStore((s) => s.setResolution)
  const isCustom      = !OPTIONS.some((o) => o.id === resolution)

  return (
    <div className="inline-flex rounded-sm bg-slate-950/30 border border-slate-800/60 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setResolution(opt.id)}
          className={`px-3 py-1 text-xs font-medium rounded-sm transition-all
            ${resolution === opt.id
              ? 'bg-cyan-600 text-white'
              : 'text-gray-300 hover:text-white'}`}
        >
          {opt.label}
        </button>
      ))}
      {/* Custom resolution from the wizard — shown active until a preset is picked. */}
      {isCustom && (
        <span className="px-3 py-1 text-xs font-medium font-mono rounded-sm bg-cyan-600 text-white">
          {resolution}
        </span>
      )}
    </div>
  )
}
