// A titled group of stats. Kept deliberately plain: this is a data page, and
// the job is legibility down a column rather than decoration.
//
// The border came off when the frame-rate cards did. With 155 of those gone the
// remaining panels were the only boxes left on the page, which made eight
// reference panels the loudest thing on it. The Section heading and the rule
// between sections carry the grouping now.
export default function StatPanel({ title, subtitle, children, footnote }) {
  return (
    <section className="py-1">
      <header className="mb-2">
        <h3 className="text-sm text-ink">{title}</h3>
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
