import { useState } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import { gameFps, FPS_TARGETS } from '../lib/gameFps'
import { suggestUpgrade } from '../lib/upgradeAdvisor'
import gamesData from '../data/gamesData.json'
import partsData from '../data/partsData.json'
import ResolutionToggle from './ResolutionToggle'
import { PANEL } from '../lib/uiTokens'

const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

export default function GamePanel() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const resolution = useBuilderStore((s) => s.resolution)
  const budget = useBuilderStore((s) => s.budget)
  const cpu = selectedParts.cpu
  const gpu = selectedParts.gpu

  const [gameId, setGameId] = useState(gamesData[0].id)
  const [target, setTarget] = useState(60)

  const game = gamesData.find((g) => g.id === gameId) ?? gamesData[0]
  const resLabel = RES_LABEL[resolution] ?? resolution
  const fps = gameFps(cpu, gpu, resolution, game)
  const hits = fps >= target
  const upg = cpu && gpu && !hits ? suggestUpgrade(selectedParts, budget, partsData, resolution) : null
  const upgraded = upg ? { ...selectedParts, [upg.category]: upg.toPart } : null
  const upgFps = upgraded ? gameFps(upgraded.cpu, upgraded.gpu, resolution, game) : 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <div className={`${PANEL} p-5`}>
          {!cpu || !gpu ? (
            <p className="text-sm text-slate-400 py-6 text-center">Select a CPU and a GPU to check game performance.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <select
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-sm text-slate-100 px-3 py-2 focus:outline-none focus:border-cyan-400"
                >
                  {gamesData.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <span className="text-xs text-slate-500">target</span>
                <div className="inline-flex rounded-sm bg-slate-950/30 border border-slate-800/60 p-0.5">
                  {FPS_TARGETS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTarget(t)}
                      className={`px-3 py-1 text-xs font-mono rounded-sm transition-all ${target === t ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <ResolutionToggle />
              </div>

              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-4xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">{fps}</span>
                <span className="text-sm text-slate-400">est. FPS @ {resLabel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-sm border ${hits ? 'text-emerald-300 border-emerald-400/40' : 'text-red-400 border-red-400/40'}`}>
                  {hits ? `clears ${target}` : `misses ${target}`}
                </span>
              </div>

              {!hits && (
                <div className="mt-4 text-xs text-slate-300 bg-cyan-500/[0.06] border border-cyan-400/20 rounded-sm p-3">
                  {upg ? (
                    <>Upgrade <span className="uppercase">{upg.category}</span> → <span className="text-cyan-300">{upg.toPart.name}</span>{' '}
                      <span className="font-mono text-emerald-300">+£{upg.extraCost.toFixed(0)}</span> → ~<span className="font-mono text-cyan-300">{upgFps}</span> FPS{' '}
                      {upgFps >= target ? `(clears ${target})` : `(still under ${target})`}</>
                  ) : (
                    <>No affordable upgrade reaches {target} FPS at this budget.</>
                  )}
                </div>
              )}

              <p className="mt-4 text-[10px] text-slate-600">Estimated from CPU + GPU performance — not a benchmark.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
