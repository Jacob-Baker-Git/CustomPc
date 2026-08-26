import { useState } from 'react'
import { Info } from 'lucide-react'

// The ⓘ badge, in one component because it was in two and they disagreed.
//
// ScoreInfo sat grey at rest and lit brass on hover. InfoDisclaimer, over the 3D
// viewport, sat brass at rest permanently. Same affordance, same gesture, two
// different colours on the same page — which does not read as "these are
// different things", it reads as the 3D one being more important. It is not.
//
// Grey at rest is the one that wins. A permanently lit badge competes with the
// content it annotates, and annotation is the entire job here: nothing behind
// either badge is required reading, both are there for the person who wants to
// know how much to trust what they are looking at.
//
// The two callers differ in three ways that ARE real, so they are props rather
// than a second component: the viewport badge floats over a busy WebGL canvas
// and needs its own opaque chip, it is larger because it is a hit target on a
// canvas rather than an inline glyph beside 14px text, and its popover hangs
// from the right edge because it is pinned to the top-right corner.
export default function InfoBadge({ label, align = 'left', floating = false, width = 'w-72', children }) {
  const [open, setOpen] = useState(false)

  const box = floating ? 'w-7 h-7 bg-surface' : 'w-5 h-5'
  const icon = floating ? 14 : 11
  const side = align === 'right' ? 'right-0' : 'left-0'

  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`${box} flex items-center justify-center rounded-full border border-line text-muted hover:text-brass hover:border-brass transition-colors`}
      >
        <Info size={icon} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="note"
          className={`absolute ${side} top-8 z-50 ${width} bg-surface border border-line rounded-xl p-3.5 text-xs text-muted shadow-xl`}
        >
          {children}
        </div>
      )}
    </span>
  )
}
