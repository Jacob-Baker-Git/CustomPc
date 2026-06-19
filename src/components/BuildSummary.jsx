import { useState } from 'react'
import useBuilderStore, { selTotalSpent, selPeripheralsTotal, selTotalPower } from '../store/useBuilderStore'
import { CATEGORIES } from '../lib/categories'
import { searchUrl } from '../lib/retailerLinks'
import { buildShareUrl } from '../lib/shareLink'
import { PANEL } from '../lib/uiTokens'
import GamePerformanceList from './GamePerformanceList'

const PERIPHERAL_LABELS = { monitor: 'Monitor', keyboard: 'Keyboard', mouse: 'Mouse', headset: 'Headset' }
const PERIPHERAL_ORDER = ['monitor', 'keyboard', 'mouse', 'headset']
const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

function Row({ label, name, price }) {
  return (
    <div className="flex items-center py-1.5 border-t border-slate-800/50">
      <span className="font-mono text-[11px] uppercase text-slate-500 w-28 shrink-0 pr-2">{label}</span>
      <span className="flex-1 text-sm text-slate-100 truncate">{name}</span>
      <span className="font-mono text-sm text-slate-300 w-20 text-right">£{price.toFixed(2)}</span>
      <a
        href={searchUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-16 text-right text-xs text-cyan-400 hover:text-cyan-300"
      >
        Buy ↗
      </a>
    </div>
  )
}

export default function BuildSummary() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const selectedPeripherals = useBuilderStore((s) => s.selectedPeripherals)
  const budget = useBuilderStore((s) => s.budget)
  const buildTotal = useBuilderStore(selTotalSpent)
  const periphTotal = useBuilderStore(selPeripheralsTotal)
  const power = useBuilderStore(selTotalPower)
  const resolution = useBuilderStore((s) => s.resolution)
  const [copied, setCopied] = useState(false)

  const buildRows = CATEGORIES.map((c) => ({ key: c.id, label: c.label, part: selectedParts[c.id] })).filter((r) => r.part)
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

  function copyPartsList() {
    const lines = [...buildRows, ...periphRows].map((r) => `${r.label}: ${r.part.name} — £${r.part.price.toFixed(2)}`)
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {})
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
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
                  <div className="mt-4 mb-1 text-[11px] uppercase tracking-wider text-slate-500">Core build</div>
                  {buildRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} price={r.part.price} />)}
                </>
              )}
              {periphRows.length > 0 && (
                <>
                  <div className="mt-5 mb-1 text-[11px] uppercase tracking-wider text-slate-500">Peripherals</div>
                  {periphRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} price={r.part.price} />)}
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
            </>
          )}

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={copyShareLink}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
              onClick={copyPartsList}
              disabled={isEmpty}
              className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Copy parts list
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
