import { useState } from 'react'
import { Info } from 'lucide-react'

const TEXT =
  "This 3D view is a stylised approximation to help you picture the build — your actual PC won't look exactly like this."

// An "ⓘ" badge that reveals a disclaimer on hover (title) or click (popover).
export default function InfoDisclaimer() {
  const [open, setOpen] = useState(false)

  return (
    <div className="absolute top-20 right-6 z-40">
      <button
        onClick={() => setOpen((o) => !o)}
        title={TEXT}
        aria-label={TEXT}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-950/30 backdrop-blur-md border border-slate-800/60 text-cyan-300 hover:border-cyan-400/60 transition-colors"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-950/60 backdrop-blur-md border border-slate-800/60 rounded-sm p-3 text-xs text-gray-300">
          {TEXT}
        </div>
      )}
    </div>
  )
}
