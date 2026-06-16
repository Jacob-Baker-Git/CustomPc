import useBuilderStore from '../store/useBuilderStore'

const OPTIONS = [
  { id: '1080p', label: '1080p' },
  { id: '1440p', label: '1440p' },
  { id: '4k',    label: '4K' },
]

export default function ResolutionToggle() {
  const resolution    = useBuilderStore((s) => s.resolution)
  const setResolution = useBuilderStore((s) => s.setResolution)

  return (
    <div className="inline-flex rounded-sm bg-slate-950/30 border border-slate-800/60 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setResolution(opt.id)}
          className={`px-3 py-1 text-xs font-medium rounded-sm transition-all
            ${resolution === opt.id
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
              : 'text-gray-300 hover:text-white'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
