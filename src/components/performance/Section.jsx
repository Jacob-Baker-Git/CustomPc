// A titled band of related panels.
//
// The page used to be nine identical bordered boxes in one flat grid, which
// gave every figure the same weight and buried the frame rates — the thing the
// page exists to answer — in ninth place. Grouping is what fixes that: the
// heading carries the hierarchy so the panels inside can stay quiet, and the
// eye gets three or four landmarks to navigate by instead of nine.
//
// Spacing does the separating, not more borders. Adding rules between groups on
// a page already full of bordered cards just adds noise.
export default function Section({ title, blurb, children, className = '' }) {
  return (
    <section className={`mt-7 first:mt-0 ${className}`}>
      <div className="mb-2.5">
        <h3 className="text-sm text-ink">{title}</h3>
        {blurb && (
          <p className="mt-0.5 max-w-[68ch] text-[11px] text-muted leading-relaxed">{blurb}</p>
        )}
      </div>
      {children}
    </section>
  )
}
