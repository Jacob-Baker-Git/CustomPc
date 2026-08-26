import { ELEV_GROUP } from '../../lib/uiTokens'

// A titled band of related panels, drawn as an opaque module.
//
// The page used to be nine identical bordered boxes in one flat grid, which
// gave every figure the same weight and buried the frame rates — the thing the
// page exists to answer — in ninth place. Grouping is what fixes that: the
// heading carries the hierarchy so the panels inside can stay quiet, and the
// eye gets three or four landmarks to navigate by instead of nine.
//
// ⚠️ THE SURFACE IS LOAD-BEARING, not decoration. BuilderScreen renders
// <BoardBackground /> with no `column`, so this screen has NO SCRIM and the
// board is drawn at full strength behind it. Opaque modules are the only thing
// keeping text off it: 28 glyph runs on this tab were sitting on bare board
// while this section was transparent, including its own heading and blurb.
// e2e/builderLegibility.spec.js fails if it goes back.
//
// A hairline rule separated these bands while they were transparent. The gap
// between two opaque cards does that job now, and uiTokens.js is explicit that
// depth rather than borders carries hierarchy here — the border is gone rather
// than merely moved.
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
      className={`mt-4 rounded-xl ${ELEV_GROUP} p-4 sm:p-5 first:mt-0 ${className}`}
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
