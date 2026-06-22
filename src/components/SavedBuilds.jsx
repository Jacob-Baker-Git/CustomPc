import useSavedStore from '../store/useSavedStore'
import useBuilderStore from '../store/useBuilderStore'
import { decodeBuild } from '../lib/buildCodec'
import { shareUrlFromCode } from '../lib/shareLink'
import { PANEL } from '../lib/uiTokens'

export default function SavedBuilds({ onLoaded }) {
  const saved = useSavedStore((s) => s.saved)
  const removeSaved = useSavedStore((s) => s.removeSaved)

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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <div className={`${PANEL} p-5`}>
          <h2 className="text-lg text-white mb-3">Saved builds</h2>
          {saved.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No saved builds yet — build something and hit "Save PC" in Summary.</p>
          ) : (
            <div className="space-y-1">
              {saved.map((b) => (
                <div key={b.id} className="flex items-center gap-3 border-t border-slate-800/50 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-100 truncate">{b.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{new Date(b.savedAt).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => load(b.code)} className="text-xs px-3 py-1.5 rounded-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white transition-all">Load</button>
                  <button onClick={() => copyLink(b.code)} className="text-xs px-3 py-1.5 rounded-sm border border-slate-700/70 text-slate-200 hover:border-slate-500 transition-all">Copy link</button>
                  <button onClick={() => removeSaved(b.id)} aria-label={`Delete ${b.name}`} className="w-7 h-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-white hover:bg-red-500/80 text-sm">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
