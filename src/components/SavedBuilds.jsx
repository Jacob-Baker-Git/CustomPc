import { useState } from 'react'
import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { decodeBuild } from '../lib/buildCodec'
import { shareUrlFromCode } from '../lib/shareLink'
import { estimateFps } from '../lib/fpsEstimate'
import { CATEGORIES } from '../lib/categories'
import { PANEL_STRONG, TELEMETRY } from '../lib/uiTokens'
import RamBox from './RamBox'

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
    <div className="mt-5 pt-4 border-t border-line">
      <h3 className="text-sm text-ink font-semibold mb-2">Comparison</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left">
            <th className="py-1.5 pr-2 font-normal text-muted w-24" />
            <th className="py-1.5 pr-2 text-tech">{a.name}</th>
            <th className="py-1.5 text-tech">{b.name}</th>
          </tr>
        </thead>
        <tbody>
          {summaryRows.map(([label, va, vb]) => (
            <tr key={label} className="border-t border-line">
              <td className="py-1.5 pr-2 text-muted uppercase text-[10px] font-mono">{label}</td>
              <td className={`py-1.5 pr-2 ${TELEMETRY} text-ink`}>{va}</td>
              <td className={`py-1.5 ${TELEMETRY} text-ink`}>{vb}</td>
            </tr>
          ))}
          {CATEGORIES.map((cat) => {
            const pa = da.parts[cat.id]
            const pb = db.parts[cat.id]
            if (!pa && !pb) return null
            const differs = pa?.id !== pb?.id
            return (
              <tr key={cat.id} className="border-t border-line">
                <td className="py-1.5 pr-2 text-muted uppercase text-[10px] font-mono">{cat.label}</td>
                <td className={`py-1.5 pr-2 ${differs ? 'text-ink' : 'text-muted'}`}>{pa?.name ?? '—'}</td>
                <td className={`py-1.5 ${differs ? 'text-ink' : 'text-muted'}`}>{pb?.name ?? '—'}</td>
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
    <div>
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-12">
        <RamBox seated={saved.length > 0} open={pair.length === 2}>
          <div className="flex items-baseline justify-between mb-3">
            {/* h1, not h2: this component is a whole screen (App renders it as
                the `saved` flow, nowhere else), so this line is the screen's
                title and the only heading above the rows. As an h2 it left the
                screen with no top level at all. Size is unchanged — the tag
                carries the outline, `text-lg` carries the look. */}
            <h1 className="text-lg text-ink">Saved builds</h1>
            {saved.length > 1 && (
              <span className="text-[11px] text-muted">tick two builds to compare</span>
            )}
          </div>
          {saved.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">No saved builds yet. Build something and hit "Save PC" in Summary.</p>
          ) : (
            <div className="space-y-1">
              {saved.map((b) => {
                const ticked = compareIds.includes(b.id)
                return (
                  <div key={b.id} className="flex items-center gap-3 border-t border-line py-2">
                    <input
                      type="checkbox"
                      aria-label={`Compare ${b.name}`}
                      checked={ticked}
                      disabled={!ticked && compareIds.length >= 2}
                      onChange={() => toggleCompare(b.id)}
                      className="accent-accent disabled:opacity-30"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{b.name}</div>
                      <div className="text-[11px] text-muted font-mono">{new Date(b.savedAt).toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => load(b.code)} className="text-xs px-3 py-1.5 rounded-lg bg-brass hover:brightness-110 text-accent-ink transition-colors">Load</button>
                    <button onClick={() => copyLink(b.code)} className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink hover:border-line-strong transition-colors">Copy link</button>
                    <button onClick={() => setPendingDelete({ id: b.id, name: b.name })} aria-label={`Delete ${b.name}`} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-bad text-sm">&times;</button>
                  </div>
                )
              })}
            </div>
          )}
          {pair.length === 2 && <CompareTable a={pair[0]} b={pair[1]} />}
        </RamBox>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Delete saved build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-ink text-sm font-semibold mb-2">Delete "{pendingDelete.name}"?</h3>
            <p className="text-xs text-muted">This permanently removes the saved build. It can't be undone.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingDelete(null)} className="text-xs px-3.5 py-2 rounded-lg border border-line text-muted hover:border-line-strong transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="text-xs px-3.5 py-2 rounded-lg border border-bad text-bad hover:brightness-110 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
