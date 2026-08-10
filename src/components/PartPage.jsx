import { ExternalLink, ArrowRight } from 'lucide-react'
import useCatalogStore from '../store/useCatalogStore'
import useBuilderStore from '../store/useBuilderStore'
import { partById, partPath, compatibilityNotes, pairings } from '../lib/partPages'
import { partStats } from '../lib/partStats'
import { insight, gpuResChips, specRows } from '../lib/specSheetContent'
import { searchUrl } from '../lib/retailerLinks'
import { PRICE_SNAPSHOT, FPS_CAVEAT } from '../lib/siteContent'
import { enterBuildTab } from '../lib/enterBuildTab'

const CATEGORY_LABEL = {
  cpu: 'Processor',
  gpu: 'Graphics card',
  motherboard: 'Motherboard',
  ram: 'Memory',
  storage: 'Storage',
  psu: 'Power supply',
  case: 'Case',
  cooler: 'CPU cooler',
  fans: 'Case fans',
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  )
}

// One page per catalogue part. The substance is the point: a page carrying only a
// name and a price is doorway content, so everything below is derived from the
// catalogue by partPages.js — what it fits, how many of the things it needs
// exist, and what to put beside it. See that module for why nothing is invented.
export default function PartPage({ partId, onNavigate }) {
  const parts = useCatalogStore((s) => s.parts)
  const addPart = useBuilderStore((s) => s.addPart)
  const setFlow = useBuilderStore((s) => s.setFlow)
  const part = partById(parts, partId)

  // The catalogue swaps from the bundled snapshot to live Supabase at runtime, so
  // a part can legitimately be absent for one render. Say "not found" rather than
  // crashing, and keep a route into the browser.
  if (!part) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-2">Part not found</h1>
        <p className="text-muted text-sm mb-6">
          Nothing in the catalogue has the id <span className="font-mono text-ink">{partId}</span>.
          It may have been renamed or withdrawn.
        </p>
        <a href="/parts" className="text-accent text-sm hover:underline">Browse every part →</a>
      </div>
    )
  }

  const stats = partStats(part)
  const derived = stats.filter((s) => s.derived)
  const notes = compatibilityNotes(part, parts)
  const partners = pairings(part, parts)
  const note = insight(part)

  const buildWithIt = () => {
    addPart(part.category, part)
    enterBuildTab()
    setFlow('builder')
    onNavigate?.(null)
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-xs text-muted mb-3">
        <a href="/parts" className="hover:text-accent">Parts browser</a>
        <span className="mx-1.5" aria-hidden="true">/</span>
        <span className="capitalize">{CATEGORY_LABEL[part.category] ?? part.category}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-1">{part.name}</h1>
      <p className="text-muted text-sm">
        {CATEGORY_LABEL[part.category] ?? part.category} · {part.brand}
        {part.legacy && (
          <span className="ml-2 align-middle text-[10px] uppercase tracking-wide text-muted border border-line rounded px-1.5 py-0.5">
            Discontinued
          </span>
        )}
      </p>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-4">
        <span className="font-mono text-2xl text-accent">£{part.price.toFixed(2)}</span>
        {/* Never "price". These are curated estimates and the terms page says so;
            a page generated 540 times over is the last place to blur that. */}
        <span className="text-xs text-muted">curated estimate, {PRICE_SNAPSHOT}</span>
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <button
          onClick={buildWithIt}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-accent bg-accent-soft text-accent text-sm font-semibold hover:brightness-110 transition-all"
        >
          Build a PC with this
          <ArrowRight size={15} aria-hidden="true" />
        </button>
        <a
          href={searchUrl(part.name, part.brand)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-line text-muted text-sm hover:text-ink hover:border-line-strong transition-colors"
        >
          Find best price
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>

      {note && <p className="text-sm text-muted leading-relaxed mt-6">{note}</p>}

      {notes.length > 0 && (
        <Section title="What it works with">
          <dl className="space-y-2">
            {notes.map(({ label, detail }) => (
              <div key={label} className="border border-line rounded-lg px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
                <dd className="text-sm text-ink mt-0.5">{detail}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {part.category === 'gpu' && part.perfScore > 0 && (
        <Section title="Rough frame rates">
          <div className="flex flex-wrap gap-2">
            {gpuResChips(part).map(({ res, fps }) => (
              <span key={res} className="text-xs font-mono px-2 py-1 rounded-md border border-line text-muted">
                ~{fps} fps @ {res.split(' ')[0]}
              </span>
            ))}
          </div>
          <p className="text-xs text-faint mt-2 leading-relaxed">{FPS_CAVEAT}</p>
        </Section>
      )}

      {derived.length > 0 && (
        <Section title="Value and efficiency">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {derived.map(({ label, value, unit, hint }) => (
              <div key={label} className="contents">
                <dt className="text-muted" title={hint || undefined}>{label}</dt>
                <dd className="text-accent text-right font-mono tabular-nums">{value}{unit}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section title="Specifications">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {specRows(part).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="text-ink text-right font-mono tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {partners.length > 0 && (
        <Section title="Good alongside it">
          <ul className="space-y-2">
            {partners.map(({ part: p, why }) => (
              <li key={p.id}>
                {/* A plain anchor, so this is a crawlable link between two part
                    pages as well as a click. The internal linking is half of what
                    makes 540 pages worth having rather than 540 orphans. */}
                <a
                  href={partPath(p)}
                  className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2 hover:border-accent transition-colors group"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-ink truncate group-hover:text-accent">{p.name}</span>
                    <span className="block text-xs text-muted">{why}</span>
                  </span>
                  <span className="font-mono text-sm text-accent shrink-0">£{p.price.toFixed(2)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
