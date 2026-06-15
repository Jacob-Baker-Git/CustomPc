import { useState } from 'react'

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
        className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-900/70 backdrop-blur-md border border-white/10 text-cyan-300 text-sm italic font-semibold hover:border-cyan-400/60 hover:shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-all"
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 text-xs text-gray-300 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
          {TEXT}
        </div>
      )}
    </div>
  )
}
