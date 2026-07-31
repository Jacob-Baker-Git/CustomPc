import { useState } from 'react'
import { Info } from 'lucide-react'

// What the CustomPC score is, and — just as importantly — what it is not.
// The 3D view already carries a "this is an approximation" disclaimer; the score
// deserves the same honesty, because a single number out of 100 invites more
// confidence than the method can carry.
export default function ScoreInfo() {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="How the CustomPC score is calculated"
        title="How the CustomPC score is calculated"
        className="w-5 h-5 flex items-center justify-center rounded-full border border-line text-muted hover:text-accent hover:border-accent transition-colors"
      >
        <Info size={11} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="note"
          className="absolute left-0 top-7 z-50 w-72 bg-surface border border-line rounded-xl p-3.5 text-xs text-muted shadow-xl"
        >
          <p className="text-ink font-semibold mb-1.5">How this score works</p>
          <p>
            Each part is ranked against every other part of its type in our catalogue, then
            checked against what the use case you picked actually needs. Those two views are
            combined, and the build is also checked for parts that hold each other back — a
            fast GPU behind a slow CPU, too little RAM, a PSU with no headroom.
          </p>
          <p className="mt-2">
            Anything we have no data for never counts against you, and hitting the target for
            your use case scores highly rather than perfectly — the top of the scale is
            reserved for genuinely overspecified builds.
          </p>
          <p className="mt-2.5 text-faint">
            Treat it as a rough guide, not a verdict. It is our opinion from list prices and
            spec sheets, not a benchmark — much like the 3D view, it is there to give you a
            feel for the build rather than to be exact. Real performance depends on the
            games and software you run, your settings, and your monitor.
          </p>
        </div>
      )}
    </span>
  )
}
