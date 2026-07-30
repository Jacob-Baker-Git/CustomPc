import { useMemo, useState } from 'react'
import useBuilderStore, { selTotalSpent, selPeripheralsTotal, selTotalPower } from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { CATEGORIES } from '../lib/categories'
import { searchUrl } from '../lib/retailerLinks'
import { buildShareUrl } from '../lib/shareLink'
import { buildMarkdown } from '../lib/buildMarkdown'
import { encodeBuild } from '../lib/buildCodec'
import { rateBuild } from '../lib/partRatings'
import { USE_CASE_LABEL, BUILD_PROFILES } from '../lib/buildProfiles'
import useSavedStore from '../store/useSavedStore'
import { PANEL, PANEL_STRONG, TELEMETRY } from '../lib/uiTokens'
import GamePerformanceList from './GamePerformanceList'
import DimensionsChecklist from './DimensionsChecklist'

const PERIPHERAL_LABELS = { monitor: 'Monitor', keyboard: 'Keyboard', mouse: 'Mouse', headset: 'Headset' }
const PERIPHERAL_ORDER = ['monitor', 'keyboard', 'mouse', 'headset']
const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))
const scoreText = (s) => (s >= 80 ? 'text-good' : s >= 50 ? 'text-ok' : 'text-bad')

function Row({ label, name, brand, price }) {
  return (
    <div className="flex items-center py-1.5 border-t border-line">
      <span className="font-mono text-[11px] uppercase text-muted w-28 shrink-0 pr-2">{label}</span>
      <span className="flex-1 text-sm text-ink truncate">{name}</span>
      <span className="font-mono text-sm text-muted w-20 text-right">£{price.toFixed(2)}</span>
      <a
        href={searchUrl(name, brand)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-28 text-right text-xs text-accent hover:text-accent whitespace-nowrap"
      >
        Find Best Price ↗
      </a>
    </div>
  )
}

function MissingRow({ label }) {
  return (
    <div className="flex items-center py-1.5 border-t border-line">
      <span className="font-mono text-[11px] uppercase text-muted w-28 shrink-0 pr-2">{label}</span>
      <span className="flex-1 text-sm text-ok">
        <span aria-hidden="true" className="mr-1.5">⚠</span>Not selected
      </span>
      <span className="font-mono text-sm text-faint w-20 text-right">—</span>
      <span className="w-28" />
    </div>
  )
}

export default function BuildSummary() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const selectedPeripherals = useBuilderStore((s) => s.selectedPeripherals)
  const budget = useBuilderStore((s) => s.budget)
  const clearBuild = useBuilderStore((s) => s.clearBuild)
  const setFlow = useBuilderStore((s) => s.setFlow)
  const saveBuild = useSavedStore((s) => s.saveBuild)
  const buildTotal = useBuilderStore(selTotalSpent)
  const periphTotal = useBuilderStore(selPeripheralsTotal)
  const power = useBuilderStore(selTotalPower)
  const resolution = useBuilderStore((s) => s.resolution)
  const useCase = useBuilderStore((s) => s.useCase)
  const partsData = useCatalogStore((s) => s.parts)
  const [copied, setCopied] = useState(false)
  const [showFps, setShowFps] = useState(false)

  // The same rating the Build tab shows. This tab used to open with a 22-row
  // frame-rate table, which answered a question only gamers had asked and
  // disagreed with the score everywhere else on the site.
  const rating = useMemo(
    () => rateBuild(selectedParts, useCase, partsData),
    [selectedParts, useCase, partsData],
  )
  const weakest = useMemo(
    () => Object.entries(rating.parts).sort((a, b) => a[1].score - b[1].score).filter(([, i]) => i.isWeakLink).slice(0, 3),
    [rating],
  )
  const framePaced = Boolean(BUILD_PROFILES[useCase]?.cpuGpuPaced)

  const buildRows = CATEGORIES.map((c) => ({ key: c.id, label: c.label, part: selectedParts[c.id] })).filter((r) => r.part)
  const missingCount = CATEGORIES.length - buildRows.length
  const periphRows = PERIPHERAL_ORDER.map((id) => ({ key: id, label: PERIPHERAL_LABELS[id], part: selectedPeripherals[id] })).filter((r) => r.part)
  const isEmpty = buildRows.length === 0 && periphRows.length === 0
  const grandTotal = buildTotal + periphTotal
  const overBudget = budget > 0 && buildTotal > budget

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(buildShareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable */ }
  }

  function copyMarkdown() {
    const rows = [...buildRows, ...periphRows].map((r) => ({ label: r.label, name: r.part.name, price: r.part.price }))
    navigator.clipboard?.writeText(buildMarkdown(rows, grandTotal)).catch(() => {})
  }

  const [saveOpen, setSaveOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const fallbackName = `Build · £${grandTotal.toFixed(0)}`

  function handleSave() {
    setNameDraft(fallbackName)
    setSaveOpen(true)
  }

  function confirmSave() {
    const code = encodeBuild({ budget, resolution, parts: selectedParts, peripherals: selectedPeripherals })
    saveBuild(nameDraft.trim() || fallbackName, code)
    setSaveOpen(false)
  }

  function handleClear() {
    setClearOpen(true)
  }

  function confirmClear() {
    clearBuild()
    setClearOpen(false)
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-12">
        <div className={`${PANEL} p-5`}>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg text-ink">Your build</h2>
            <span className="font-mono text-base text-accent">
              £{buildTotal.toFixed(0)}
              {budget > 0 && (
                <span className={`text-sm ${overBudget ? 'text-bad' : 'text-muted'}`}> / £{budget.toFixed(0)}</span>
              )}
            </span>
          </div>

          {isEmpty ? (
            <p className="text-sm text-muted py-6 text-center">No parts selected yet — head to the Build tab.</p>
          ) : (
            <>
              {rating.overall > 0 && (
                <div className="mt-4 rounded-lg border border-line bg-surface-2 px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-display text-3xl font-extrabold tabular-nums leading-none ${scoreText(rating.overall)}`}>{rating.overall}</span>
                    <span className="text-xs text-faint">/100</span>
                    <span className="text-[11px] text-muted ml-1">CustomPC score</span>
                    <span className={`text-xs font-semibold ml-auto ${scoreText(rating.overall)}`}>{rating.verdict}</span>
                  </div>
                  <p className="text-[11px] text-faint mt-1.5">
                    Rated for <span className="text-muted">{USE_CASE_LABEL[useCase] ?? useCase}</span>. Change that on the Build tab.
                  </p>
                  {weakest.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {weakest.map(([cat, info]) => (
                        <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded-md border border-line text-muted">
                          {CAT_LABEL[cat] ?? cat} <span className={`${TELEMETRY} ${scoreText(info.score)}`}>{info.score}</span>
                        </span>
                      ))}
                      <span className="text-[10px] text-faint self-center">weakest links</span>
                    </div>
                  )}
                </div>
              )}

              {buildRows.length > 0 && (
                <>
                  <div className="mt-4 mb-1 flex items-baseline justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-muted">Core build</span>
                    {missingCount > 0 && (
                      <span className="text-[11px] text-ok">{missingCount} part{missingCount === 1 ? '' : 's'} missing</span>
                    )}
                  </div>
                  {CATEGORIES.map((c) => {
                    const part = selectedParts[c.id]
                    return part
                      ? <Row key={c.id} label={c.label} name={part.name} brand={part.brand} price={part.price} />
                      : <MissingRow key={c.id} label={c.label} />
                  })}
                </>
              )}
              {periphRows.length > 0 && (
                <>
                  <div className="mt-5 mb-1 text-[11px] uppercase tracking-wider text-muted">Peripherals</div>
                  {periphRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} brand={r.part.brand} price={r.part.price} />)}
                </>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 pt-3 border-t border-line text-xs text-muted">
                <span>Build <span className="font-mono text-muted">£{buildTotal.toFixed(2)}</span></span>
                <span>Peripherals <span className="font-mono text-muted">£{periphTotal.toFixed(2)}</span></span>
                <span>Draw <span className="font-mono text-ok">{power}W</span></span>
                <span>Total <span className="font-mono text-ink">£{grandTotal.toFixed(2)}</span></span>
              </div>

              {/* Frame rates are now a detail behind a toggle, and only for the
                  use cases where they mean anything — not the headline table
                  this tab opened with regardless of what the PC was for. */}
              {framePaced && selectedParts.cpu && selectedParts.gpu && (
                <div className="mt-5">
                  <button
                    onClick={() => setShowFps((v) => !v)}
                    aria-expanded={showFps}
                    className="text-[11px] uppercase tracking-wider text-muted hover:text-accent transition-colors"
                  >
                    Frame rates @ {RES_LABEL[resolution] ?? resolution} {showFps ? '−' : '+'}
                  </button>
                  {showFps && (
                    <GamePerformanceList cpu={selectedParts.cpu} gpu={selectedParts.gpu} resolution={resolution} limit={8} />
                  )}
                </div>
              )}
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Physical dimensions</div>
                <DimensionsChecklist />
              </div>
            </>
          )}

          <p className="mt-4 text-[10px] text-faint">
            Prices are curated estimates (July 2026), not live retail data — use Find Best Price for current prices.
          </p>

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={handleSave}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-lg border border-accent text-accent hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Save PC
            </button>
            <button
              onClick={copyShareLink}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-lg bg-accent hover:brightness-110 text-accent-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copied ? 'Copied!' : 'Copy share link'}
            </button>
            <button
              onClick={() => window.print()}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-lg border border-line text-ink hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Print
            </button>
            <button
              onClick={copyMarkdown}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-lg border border-line text-ink hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Copy as Markdown
            </button>
            <button
              onClick={handleClear}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-lg border border-bad text-bad hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Clear build
            </button>
          </div>

          {/* Saved builds moved to the hub — this is the way back to them from
              the place where saving actually happens. */}
          <button
            onClick={() => setFlow('saved')}
            className="mt-4 text-xs text-muted hover:text-accent transition-colors"
          >
            View your saved builds →
          </button>
        </div>
      </div>

      {saveOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Save build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-ink text-sm font-semibold mb-3">Save this build</h3>
            <label htmlFor="save-name" className="block text-xs text-muted mb-1">Build name</label>
            <input
              id="save-name"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSave()
                if (e.key === 'Escape') setSaveOpen(false)
              }}
              className="w-full bg-surface-2 text-ink text-sm px-3 py-2 rounded-lg border border-line focus:outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSaveOpen(false)} className="text-xs px-3.5 py-2 rounded-lg border border-line text-muted hover:border-line-strong transition-colors">Cancel</button>
              <button onClick={confirmSave} className="text-xs px-3.5 py-2 rounded-lg bg-accent hover:brightness-110 text-accent-ink transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {clearOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Clear build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-ink text-sm font-semibold mb-2">Clear the whole build?</h3>
            <p className="text-xs text-muted">This removes every selected part and peripheral. Saved builds are kept.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setClearOpen(false)} className="text-xs px-3.5 py-2 rounded-lg border border-line text-muted hover:border-line-strong transition-colors">Cancel</button>
              <button onClick={confirmClear} className="text-xs px-3.5 py-2 rounded-lg border border-bad text-bad hover:brightness-110 transition-colors">Clear everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
