import { useState } from 'react'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { decodeBuild } from '../lib/buildCodec'
import { shareUrlFromCode } from '../lib/shareLink'
import { estimateFps } from '../lib/fpsEstimate'
import { CATEGORIES } from '../lib/categories'
import { PANEL, PANEL_STRONG, TELEMETRY } from '../lib/uiTokens'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }
const totalOf = (d) => Object.values(d.parts).reduce((s, p) => s + (p?.price ?? 0), 0)
const drawOf  = (d) => Object.values(d.parts).reduce((s, p) => s + (p?.tdp ?? 0), 0)

function CompareTable({ a, b }) {
  const da = decodeBuild(a.code)
  const db = decodeBuild(b.code)
  if (!da || !db) return null

  const summaryRows = [
    ['Total', `£${totalOf(da).toFixed(0)}`, `£${totalOf(db).toFixed(0)}`],
    ['Power draw', `${drawOf(da)}W`, `${drawOf(db)}W`],
    [
      'Est. FPS',
      da.parts.cpu && da.parts.gpu ? `${estimateFps(da.parts.cpu, da.parts.gpu, da.resolution)} @ ${RES_LABEL[da.resolution] ?? da.resolution}` : '—',
      db.parts.cpu && db.parts.gpu ? `${estimateFps(db.parts.cpu, db.parts.gpu, db.resolution)} @ ${RES_LABEL[db.resolution] ?? db.resolution}` : '—',
    ],
  ]

  return (
    <div className="mt-5 pt-4 border-t border-slate-800/60">
      <h3 className="text-sm text-white font-semibold mb-2">Comparison</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left">
            <th className="py-1.5 pr-2 font-normal text-slate-500 w-24" />
            <th className="py-1.5 pr-2 text-cyan-300">{a.name}</th>
            <th className="py-1.5 text-cyan-300">{b.name}</th>
          </tr>
        </thead>
        <tbody>
          {summaryRows.map(([label, va, vb]) => (
            <tr key={label} className="border-t border-slate-800/50">
              <td className="py-1.5 pr-2 text-slate-500 uppercase text-[10px] font-mono">{label}</td>
              <td className={`py-1.5 pr-2 ${TELEMETRY} text-slate-100`}>{va}</td>
              <td className={`py-1.5 ${TELEMETRY} text-slate-100`}>{vb}</td>
            </tr>
          ))}
          {CATEGORIES.map((cat) => {
            const pa = da.parts[cat.id]
            const pb = db.parts[cat.id]
            if (!pa && !pb) return null
            const differs = pa?.id !== pb?.id
            return (
              <tr key={cat.id} className="border-t border-slate-800/50">
                <td className="py-1.5 pr-2 text-slate-500 uppercase text-[10px] font-mono">{cat.label}</td>
                <td className={`py-1.5 pr-2 ${differs ? 'text-slate-100' : 'text-slate-400'}`}>{pa?.name ?? '—'}</td>
                <td className={`py-1.5 ${differs ? 'text-slate-100' : 'text-slate-400'}`}>{pb?.name ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function SavedBuilds({ onLoaded }) {
  const saved = useSavedStore((s) => s.saved)
  const removeSaved = useSavedStore((s) => s.removeSaved)
  const [compareIds, setCompareIds] = useState([])
  const [pendingDelete, setPendingDelete] = useState(null)

  function confirmDelete() {
    removeSaved(pendingDelete.id)
    setCompareIds((ids) => ids.filter((x) => x !== pendingDelete.id))
    setPendingDelete(null)
  }

  function toggleCompare(id) {
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 2 ? [...ids, id] : ids
    )
  }

  function load(code) {
    const d = decodeBuild(code)
    if (!d) return
    useBuilderStore.setState({
      budget: d.budget,
      resolution: d.resolution,
      selectedParts: d.parts,
      selectedPeripherals: d.peripherals,
    })
    onLoaded?.()
  }

  function copyLink(code) {
    navigator.clipboard?.writeText(shareUrlFromCode(code)).catch(() => {})
  }

  const pair = compareIds.map((id) => saved.find((b) => b.id === id)).filter(Boolean)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <div className={`${PANEL} p-5`}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg text-white">Saved builds</h2>
            {saved.length > 1 && (
              <span className="text-[11px] text-slate-500">tick two builds to compare</span>
            )}
          </div>
          {saved.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet — build something and hit "Save PC" in Summary.</p>
          ) : (
            <div className="space-y-1">
              {saved.map((b) => {
                const ticked = compareIds.includes(b.id)
                return (
                  <div key={b.id} className="flex items-center gap-3 border-t border-slate-800/50 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Compare ${b.name}`}
                      checked={ticked}
                      disabled={!ticked && compareIds.length >= 2}
                      onChange={() => toggleCompare(b.id)}
                      className="accent-cyan-500 disabled:opacity-30"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-100 truncate">{b.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => load(b.code)} className="text-xs px-3 py-1.5 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-colors">Load</button>
                    <button onClick={() => copyLink(b.code)} className="text-xs px-3 py-1.5 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 transition-colors">Copy link</button>
                    <button onClick={() => setPendingDelete({ id: b.id, name: b.name })} aria-label={`Delete ${b.name}`} className="w-7 h-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-white hover:bg-red-500/80 text-sm">&times;</button>
                  </div>
                )
              })}
            </div>
          )}
          {pair.length === 2 && <CompareTable a={pair[0]} b={pair[1]} />}
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Delete saved build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-white text-sm font-semibold mb-2">Delete "{pendingDelete.name}"?</h3>
            <p className="text-xs text-slate-400">This permanently removes the saved build. It can't be undone.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDelete(null)} className="text-xs px-3.5 py-2 rounded-sm border border-slate-700/70 text-slate-300 hover:border-slate-500 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="text-xs px-3.5 py-2 rounded-sm border border-red-700/60 text-red-300 hover:border-red-500 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
