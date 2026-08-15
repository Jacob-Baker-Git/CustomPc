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
// `action` is an optional control belonging to the band as a whole — the Frame
// rates section puts its resolution picker there. It sits on the heading's own
// line rather than above the table, so it reads as part of the section header
// instead of as another row of chrome.
//
// `ref` is an ordinary prop: this is React 19, so no forwardRef wrapper.
export default function Section({ title, blurb, children, className = '', action, ref }) {
  return (
    <section
      ref={ref}
      className={`mt-7 border-t border-line pt-5 first:mt-0 first:border-t-0 first:pt-0 ${className}`}
    >
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div>
          <h3 className="text-sm text-ink">{title}</h3>
          {blurb && (
            <p className="mt-0.5 max-w-[68ch] text-[11px] text-muted leading-relaxed">{blurb}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
