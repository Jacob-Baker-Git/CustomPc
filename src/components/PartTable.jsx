import { cellText } from '../lib/partColumns'

// The desktop part picker: one row per part, a column per spec, sorted by
// clicking a header. Parts that cannot join the build stay in the list,
// dimmed, with the reason under the name — the same rule as the phone cards.
export default function PartTable({ rows, columns, sort, onSort, onPick, currentId }) {
  const ariaSort = (key) => (sort?.key !== key ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending')
  const arrow = (key) => (sort?.key !== key ? '' : sort.dir === 'asc' ? ' ↑' : ' ↓')
  const header = (key, label, numeric) => (
    <th key={key} scope="col" aria-sort={ariaSort(key)}
        className={`sticky top-0 z-10 bg-surface px-3 py-2 font-normal ${numeric ? 'text-right' : 'text-left'}`}>
      <button onClick={() => onSort(key)}
              className="min-h-6 text-[12px] uppercase tracking-wide text-faint transition-colors hover:text-brass">
        {label}{arrow(key)}
      </button>
    </th>
  )

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line">
          {header('name', 'Name', false)}
          {columns.map((c) => header(c.key, c.label, c.numeric))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ part, locked, lockReason }) => {
          const current = part.id === currentId
          const pick = () => { if (!locked) onPick(part) }
          return (
            <tr key={part.id}
                tabIndex={locked ? -1 : 0}
                aria-disabled={locked ? 'true' : undefined}
                aria-selected={current || undefined}
                onClick={pick}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pick() } }}
                className={`h-10 border-b border-line transition-colors ${locked ? 'opacity-50' : 'cursor-pointer hover:bg-surface-2 focus:bg-surface-2 focus:outline-hidden'} ${current ? 'shadow-[inset_2px_0_0_var(--brass)]' : ''}`}>
              <td className="px-3 py-1.5">
                <span data-name className="text-ink">{part.name}</span>
                {locked && lockReason && <span className="block text-[12px] text-muted">{lockReason}</span>}
              </td>
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-1.5 tabular-nums ${c.numeric ? 'text-right font-mono' : ''} ${c.key === 'price' ? 'text-brass' : 'text-muted'}`}>
                  {cellText(c, part)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
