// A plain section in the configurator look (spec 2026-10-16): no box, no
// radius, a hairline across the top to separate it from what came before.
// It replaced the RAM-stick panels. `title` and `aside` give it a heading row
// (wide heading on the left, a figure or control on the right) when wanted.
export default function Block({ as: Tag = 'section', title, aside, className = '', children }) {
  return (
    <Tag className={`border-t border-line pt-4 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          {title && <h2 className="font-wide text-lg font-extrabold text-ink">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </Tag>
  )
}
