import { useState } from 'react'
import useBuilderStore, { selTotalSpent, selPeripheralsTotal, selTotalPower } from '../store/useBuilderStore'
import { CATEGORIES } from '../lib/categories'
import { searchUrl } from '../lib/retailerLinks'
import { buildShareUrl } from '../lib/shareLink'
import { buildMarkdown } from '../lib/buildMarkdown'
import { encodeBuild } from '../lib/buildCodec'
import useSavedStore from '../store/useSavedStore'
import { PANEL, PANEL_STRONG } from '../lib/uiTokens'
import GamePerformanceList from './GamePerformanceList'
import DimensionsChecklist from './DimensionsChecklist'

const PERIPHERAL_LABELS = { monitor: 'Monitor', keyboard: 'Keyboard', mouse: 'Mouse', headset: 'Headset' }
const PERIPHERAL_ORDER = ['monitor', 'keyboard', 'mouse', 'headset']
const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

function Row({ label, name, brand, price }) {
  return (
    <div className="flex items-center py-1.5 border-t border-slate-800/50">
      <span className="font-mono text-[11px] uppercase text-slate-500 w-28 shrink-0 pr-2">{label}</span>
      <span className="flex-1 text-sm text-slate-100 truncate">{name}</span>
      <span className="font-mono text-sm text-slate-300 w-20 text-right">£{price.toFixed(2)}</span>
      <a
        href={searchUrl(name, brand)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-28 text-right text-xs text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
      >
        Find Best Price ↗
      </a>
    </div>
  )
}

function MissingRow({ label }) {
  return (
    <div className="flex items-center py-1.5 border-t border-slate-800/50">
      <span className="font-mono text-[11px] uppercase text-slate-500 w-28 shrink-0 pr-2">{label}</span>
      <span className="flex-1 text-sm text-amber-300/90">
        <span aria-hidden="true" className="mr-1.5">⚠</span>Not selected
      </span>
      <span className="font-mono text-sm text-slate-600 w-20 text-right">—</span>
      <span className="w-28" />
    </div>
  )
}

export default function BuildSummary() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const selectedPeripherals = useBuilderStore((s) => s.selectedPeripherals)
  const budget = useBuilderStore((s) => s.budget)
  const clearBuild = useBuilderStore((s) => s.clearBuild)
  const saveBuild = useSavedStore((s) => s.saveBuild)
  const buildTotal = useBuilderStore(selTotalSpent)
  const periphTotal = useBuilderStore(selPeripheralsTotal)
  const power = useBuilderStore(selTotalPower)
  const resolution = useBuilderStore((s) => s.resolution)
  const [copied, setCopied] = useState(false)

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
            <h2 className="text-lg text-white">Your build</h2>
            <span className="font-mono text-base text-cyan-300">
              £{buildTotal.toFixed(0)}
              {budget > 0 && (
                <span className={`text-sm ${overBudget ? 'text-red-400' : 'text-slate-500'}`}> / £{budget.toFixed(0)}</span>
              )}
            </span>
          </div>

          {isEmpty ? (
            <p className="text-sm text-slate-400 py-6 text-center">No parts selected yet — head to the Build tab.</p>
          ) : (
            <>
              {buildRows.length > 0 && (
                <>
                  <div className="mt-4 mb-1 flex items-baseline justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">Core build</span>
                    {missingCount > 0 && (
                      <span className="text-[11px] text-amber-300/90">{missingCount} part{missingCount === 1 ? '' : 's'} missing</span>
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
                  <div className="mt-5 mb-1 text-[11px] uppercase tracking-wider text-slate-500">Peripherals</div>
                  {periphRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} brand={r.part.brand} price={r.part.price} />)}
                </>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-500">
                <span>Build <span className="font-mono text-slate-300">£{buildTotal.toFixed(2)}</span></span>
                <span>Peripherals <span className="font-mono text-slate-300">£{periphTotal.toFixed(2)}</span></span>
                <span>Draw <span className="font-mono text-amber-400">{power}W</span></span>
                <span>Total <span className="font-mono text-slate-100">£{grandTotal.toFixed(2)}</span></span>
              </div>

              {selectedParts.cpu && selectedParts.gpu && (
                <div className="mt-5">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">How it runs @ {RES_LABEL[resolution] ?? resolution}</div>
                  <GamePerformanceList cpu={selectedParts.cpu} gpu={selectedParts.gpu} resolution={resolution} />
                </div>
              )}
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Physical dimensions</div>
                <DimensionsChecklist />
              </div>
            </>
          )}

          <p className="mt-4 text-[10px] text-slate-600">
            Prices are curated estimates (July 2026), not live retail data — use Find Best Price for current prices.
          </p>

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={handleSave}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-cyan-500/60 text-cyan-300 hover:border-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Save PC
            </button>
            <button
              onClick={copyShareLink}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copied ? 'Copied!' : 'Copy share link'}
            </button>
            <button
              onClick={() => window.print()}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Print
            </button>
            <button
              onClick={copyMarkdown}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Copy as Markdown
            </button>
            <button
              onClick={handleClear}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-red-700/60 text-red-300 hover:border-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Clear build
            </button>
          </div>
        </div>
      </div>

      {saveOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Save build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-white text-sm font-semibold mb-3">Save this build</h3>
            <label htmlFor="save-name" className="block text-xs text-slate-400 mb-1">Build name</label>
            <input
              id="save-name"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSave()
                if (e.key === 'Escape') setSaveOpen(false)
              }}
              className="w-full bg-slate-900/80 text-white text-sm px-3 py-2 rounded-sm border border-slate-700/70 focus:outline-none focus:border-cyan-400"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSaveOpen(false)} className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-300 hover:border-slate-500 transition-colors">Cancel</button>
              <button onClick={confirmSave} className="text-xs px-3.5 py-2 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {clearOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Clear build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-white text-sm font-semibold mb-2">Clear the whole build?</h3>
            <p className="text-xs text-slate-400">This removes every selected part and peripheral. Saved builds are kept.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setClearOpen(false)} className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-300 hover:border-slate-500 transition-colors">Cancel</button>
              <button onClick={confirmClear} className="text-xs px-3.5 py-2 rounded-sm border border-red-700/60 text-red-300 hover:border-red-500 transition-colors">Clear everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
