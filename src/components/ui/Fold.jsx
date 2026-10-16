import { useIsDesktop } from '../../hooks/useIsDesktop'

// The one disclosure on the site (spec 2026-10-16). A native <details>, closed
// on phones and open on desktop, whose header always carries the section's
// key numbers, so folding hides the detail but never the answer.
//
// `open` is the INITIAL state only. React writes the attribute when the prop
// changes, and it never changes here, so after mount the <details> owns its
// own state and a re-render does not undo what the reader chose.
//
// Opening does not scroll the page, and the header stays pinned while the
// fold is open so it can be shut without scrolling back up to it.
export default function Fold({ title, summary, openOnDesktop = true, id, className = '', stickyTop = 'top-0', children }) {
  const desktop = useIsDesktop()
  return (
    <details id={id} open={openOnDesktop && desktop} className={`group border-t border-line ${className}`}>
      <summary className={`sticky ${stickyTop} z-10 flex cursor-pointer list-none items-baseline justify-between gap-4 bg-ground py-3.5 [&::-webkit-details-marker]:hidden`}>
        <span className="min-w-0">
          <span className="block font-semibold text-ink">{title}</span>
          {summary && <span className="block text-[13px] text-muted">{summary}</span>}
        </span>
        <span aria-hidden="true" className="font-mono text-muted group-open:hidden">+</span>
        <span aria-hidden="true" className="hidden font-mono text-muted group-open:inline">−</span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  )
}
