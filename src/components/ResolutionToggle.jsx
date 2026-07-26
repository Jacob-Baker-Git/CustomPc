import useBuilderStore from '../store/useBuilderStore'

const OPTIONS = [
  { id: '1080p', label: '1080p' },
  { id: '1440p', label: '1440p' },
  { id: '4k',    label: '4K' },
]

export default function ResolutionToggle() {
  const resolution    = useBuilderStore((s) => s.resolution)
  const setResolution = useBuilderStore((s) => s.setResolution)
  const customStored  = useBuilderStore((s) => s.customResolution)
  // The remembered wizard resolution, or (fallback for old share links) the
  // live resolution when it isn't a preset. Stays available as a fourth
  // option even after clicking over to a preset.
  const custom = customStored ?? (!OPTIONS.some((o) => o.id === resolution) ? resolution : null)

  return (
    <div className="inline-flex rounded-lg bg-surface border border-line p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setResolution(opt.id)}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-all
            ${resolution === opt.id
              ? 'bg-accent text-ink'
              : 'text-muted hover:text-ink'}`}
        >
          {opt.label}
        </button>
      ))}
      {custom && (
        <button
          onClick={() => setResolution(custom)}
          className={`px-3 py-1 text-xs font-medium font-mono rounded-lg transition-all
            ${resolution === custom
              ? 'bg-accent text-ink'
              : 'text-muted hover:text-ink'}`}
        >
          {custom}
        </button>
      )}
    </div>
  )
}
