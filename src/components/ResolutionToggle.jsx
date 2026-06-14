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
    <div className="inline-flex rounded-full bg-gray-800 border border-gray-700 p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setResolution(opt.id)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-all
            ${resolution === opt.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
