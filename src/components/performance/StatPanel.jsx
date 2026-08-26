// A titled group of stats. Kept deliberately plain: this is a data page, and
// the job is legibility down a column rather than decoration.
//
// ⚠️ NO SURFACE OF ITS OWN, and that is not an oversight. Every StatPanel sits
// inside a Section, which is opaque, so it is already covered. Giving both the
// same token would put two surfaces at the same value, which is the exact
// "nothing led the eye" failure uiTokens.js was written to end.
//
// `designator` is the board reference for the part this panel describes, and it
// is given ONLY where exactly one real part owns the panel. It comes from
// PartSlot's CONNECTOR map verbatim, so the same component is named the same
// way wherever it appears. A panel about a relationship (Bottleneck) or about a
// total (Power) gets none — an invented designator is decoration wearing
// structure's clothes, and performanceChrome.test.jsx fails the build for one.
export default function StatPanel({ title, subtitle, children, footnote, designator }) {
  return (
    <section className="py-1">
      <header className="mb-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm text-ink">{title}</h3>
          {designator && (
            <span
              data-designator={designator}
              className="font-mono text-[10px] tracking-[0.08em] text-gold"
            >
              {designator}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted leading-relaxed">{subtitle}</p>}
      </header>
      {children}
      {footnote && (
        <p className="mt-2.5 border-t border-line pt-2 text-[10px] text-muted leading-relaxed">
          {footnote}
        </p>
      )}
    </section>
  )
}
