import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import useCatalogStore from '../store/useCatalogStore'
import { browseParts } from '../lib/browseParts'
import { searchUrl } from '../lib/retailerLinks'
import { AFFILIATE_DISCLOSURE } from '../lib/legalContent'

const CATEGORIES = ['all', 'cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans', 'paste']
const SORTS = [
  { id: 'price-asc', label: 'Price ↑' },
  { id: 'price-desc', label: 'Price ↓' },
  { id: 'perf', label: 'Performance' },
  { id: 'name', label: 'Name' },
]

export default function PartsBrowser() {
  const parts = useCatalogStore((s) => s.parts)
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('price-asc')

  const results = useMemo(() => browseParts(parts, { category, query, sort }), [parts, category, query, sort])

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">Parts browser</h1>
      <p className="text-muted text-sm mb-6">Explore every component in the catalog.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`px-3 py-1 rounded-lg border text-xs capitalize transition-colors ${category === c ? 'border-accent text-accent bg-accent-soft' : 'border-line text-muted hover:border-accent'}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-6">
        <input
          type="search"
          placeholder="Search name or brand…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-48 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort by"
          className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
        >
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {/* Every row below carries an outbound retailer link, so the disclosure
          has to be above them — visible before the click, not in the footer. */}
      <p className="text-[11px] text-muted mb-3 leading-relaxed">{AFFILIATE_DISCLOSURE}</p>
      <p className="text-xs text-muted mb-3">{results.length} parts</p>
      <ul className="space-y-2">
        {results.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-ink truncate">{p.name}</p>
              <p className="text-xs text-muted capitalize">{p.category} · {p.brand}{p.perfScore ? ` · perf ${p.perfScore}` : ''}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-sm text-accent">£{p.price.toFixed(2)}</span>
              <a href={searchUrl(p.name, p.brand)} target="_blank" rel="noreferrer" className="text-muted hover:text-accent" aria-label={`Search ${p.name} on Amazon`}>
                <ExternalLink size={15} />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
