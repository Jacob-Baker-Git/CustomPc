import { useState } from 'react'
import { Info } from 'lucide-react'

const TEXT =
  "This 3D view is a stylised approximation to help you picture the build — your actual PC won't look exactly like this."

// An "ⓘ" badge that reveals a disclaimer on hover (title) or click (popover).
// Positioned relative to the 3D canvas container it sits inside.
export default function InfoDisclaimer() {
  const [open, setOpen] = useState(false)

  return (
    <div className="absolute top-3 right-3 z-40">
      <button
        onClick={() => setOpen((o) => !o)}
        title={TEXT}
        aria-label={TEXT}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-line text-copper hover:border-copper transition-colors"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-surface border border-line rounded-lg p-3 text-xs text-muted">
          {TEXT}
          <p className="mt-2">
            {/* CC BY 4.0 attribution for the part models lives on the Help page. */}
            <a href="/help" className="text-copper hover:underline">3D model credits</a>
          </p>
        </div>
      )}
    </div>
  )
}
