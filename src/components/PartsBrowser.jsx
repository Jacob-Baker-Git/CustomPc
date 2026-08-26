import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import useCatalogStore from '../store/useCatalogStore'
import { browseParts } from '../lib/browseParts'
import { searchUrl } from '../lib/retailerLinks'
import { hasPartPage, partPath } from '../lib/partPages'
import PartThumb from './art/PartThumb'
import { categoryLabel } from '../lib/categories'

const CATEGORIES = ['all', 'cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans', 'paste']
const SORTS = [
  { id: 'price-asc', label: 'Price ↑' },
  { id: 'price-desc', label: 'Price ↓' },
  { id: 'perf', label: 'Performance' },
  { id: 'name', label: 'Name' },
]

// The name half of a row, linked to the part's own page where there is one.
//
// A plain anchor with a real href, because this list is the ONLY route a crawler
// has into those 540 pages — a sitemap alone cannot rescue an orphan, and an
// onClick on a div is not a link. Thermal paste carries no specs so it has no
// page (see partPages.js); those rows stay plain text rather than linking
// somewhere that would only say "not found".
function PartName({ part }) {
  const body = (
    <>
      {/* The badge is a SIBLING of the truncating name, not a child of it.
          Inside it, a long name pushed the badge out under `overflow: hidden`
          and it simply vanished — measured, every one of the 50 legacy rows
          lost its badge at 320px, 43 at 375px and 24 at 414px. Silent: no
          scrollbar, no error, and the row reads as a perfectly normal part.
          `shrink-0` is what makes the name give way instead. */}
      <span className="flex items-center gap-2 text-sm text-ink">
        <span className="truncate group-hover:text-brass">{part.name}</span>
        {/* Say so plainly. These are listed so you can tell us what you already
            own; the retailer link will mostly find used or third-party stock at
            whatever price it likes. */}
        {part.legacy && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted border border-line rounded px-1.5 py-0.5">
            Discontinued
          </span>
        )}
      </span>
      <span className="block text-xs text-muted">
        {categoryLabel(part.category)} · {part.brand}{part.perfScore ? ` · perf ${part.perfScore}` : ''}
      </span>
    </>
  )

  // flex-1 so the NAME absorbs the row's spare width. With a thumbnail now
  // sitting to its left, a bare min-w-0 left the name at its content width and
  // justify-between opened a gap in the middle of every row.
  if (!hasPartPage(part)) return <div className="min-w-0 flex-1">{body}</div>

  return (
    <a href={partPath(part)} className="min-w-0 flex-1 group">{body}</a>
  )
}

export default function PartsBrowser() {
  const parts = useCatalogStore((s) => s.parts)
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('price-asc')

  const results = useMemo(() => browseParts(parts, { category, query, sort }), [parts, category, query, sort])

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Parts browser</h1>
      <p className="text-muted text-sm mb-6">Explore every component in the catalogue.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`px-3 py-1 rounded-lg border text-xs transition-colors ${category === c ? 'border-gold text-gold bg-gold-soft' : 'border-line text-muted hover:border-brass'}`}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-6">
        <input
          type="search"
          placeholder="Search name or brand…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-48 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brass"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort by"
          className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brass"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted mb-3">{results.length} parts</p>
      <ul className="space-y-2">
        {results.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2">
            {/* The picture sits OUTSIDE PartName, not inside its anchor. A
                crawler following this list should see the part's name as the
                link text; wrapping a decorative drawing into the same anchor
                adds nothing for a reader and dilutes it for a crawler. */}
            <PartThumb category={p.category} seed={p.id} size="md" />
            <PartName part={p} />
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-sm text-tech">£{p.price.toFixed(2)}</span>
              <a href={searchUrl(p.name, p.brand)} target="_blank" rel="noreferrer" className="text-muted hover:text-brass" aria-label={`Search ${p.name} on Amazon`}>
                <ExternalLink size={15} />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
