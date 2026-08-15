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
//
// ⚠️ That premise is being retired, not reversed. The cards ARE the noise, and
// Task 9 takes StatPanel's border off — so once the page is no longer full of
// bordered boxes, a heading plus spacing is carrying the grouping on its own
// rather than competing with a second system of rules. The conclusion is
// unchanged; what changed is that it is now the only mechanism, so the headings
// have to do more work.
//
// `ref` is an ordinary prop: this is React 19, so no forwardRef wrapper. The
// bottleneck section needs one to scroll itself into view when a game is picked.
export default function Section({ title, blurb, children, className = '', ref }) {
  return (
    <section ref={ref} className={`mt-7 first:mt-0 ${className}`}>
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
