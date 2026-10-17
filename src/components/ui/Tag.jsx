// The site's one PC signature: a small monospace bracket tag, e.g.
// [ ultra / 1440p ]. Used sparingly, at most twice per screen. A <b> inside
// it picks out the figure in brass.
export default function Tag({ children, className = '' }) {
  return (
    <span className={`font-mono text-[12px] tracking-[0.02em] text-muted [&_b]:font-semibold [&_b]:text-brass ${className}`}>
      [ {children} ]
    </span>
  )
}
