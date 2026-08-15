// A titled band of related panels.
//
// The page used to be nine identical bordered boxes in one flat grid, which
// gave every figure the same weight and buried the frame rates — the thing the
// page exists to answer — in ninth place. Grouping is what fixes that: the
// heading carries the hierarchy so the panels inside can stay quiet, and the
// eye gets three or four landmarks to navigate by instead of nine.
//
// Spacing separated these groups while the page was full of bordered cards —
// adding rules on top of all those boxes would have been noise. That premise
// has now expired rather than been reversed: StatPanel lost its border when the
// 155 frame-rate cards went, so a hairline rule is the only thing left marking
// where one band ends and the next begins, and the headings carry the rest.
//
// `ref` is an ordinary prop: this is React 19, so no forwardRef wrapper. The
// bottleneck section needs one to scroll itself into view when a game is picked.
export default function Section({ title, blurb, children, className = '', ref }) {
  return (
    <section
      ref={ref}
      className={`mt-7 border-t border-line pt-5 first:mt-0 first:border-t-0 first:pt-0 ${className}`}
    >
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
