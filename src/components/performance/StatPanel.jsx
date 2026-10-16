// A titled group of stats. Kept deliberately plain: this is a data page, and
// the job is legibility down a column rather than decoration.
//
// ⚠️ NO SURFACE OF ITS OWN, and that is not an oversight. Every StatPanel sits
// inside a Section, which is opaque, so it is already covered. Giving both the
// same token would put two surfaces at the same value, which is the exact
// "nothing led the eye" failure uiTokens.js was written to end.
export default function StatPanel({ title, subtitle, children, footnote }) {
  return (
    <section className="py-1">
      <header className="mb-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm text-ink">{title}</h3>
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
