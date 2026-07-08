import { useMemo } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { rateBuild, partUpgradeOptions } from '../lib/partRatings'
import { USE_CASES } from '../lib/buildProfiles'
import { PANEL, TELEMETRY } from '../lib/uiTokens'

const CAT_LABEL = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage', psu: 'PSU',
  cooler: 'Cooler', motherboard: 'Motherboard', case: 'Case', fans: 'Fans',
}
const scoreText = (s) => (s >= 80 ? 'text-emerald-300' : s >= 50 ? 'text-amber-300' : 'text-red-400')
const scoreBar  = (s) => (s >= 80 ? 'bg-emerald-400' : s >= 50 ? 'bg-amber-400' : 'bg-red-500')

// The Build-tab rating: overall /100 for the chosen use case (header dropdown
// changes it live), plus one row per part where a dropdown lists in-catalog
// upgrades that raise that part's score. Picking one swaps the live component.
export default function BuildRatingPanel() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const useCase       = useBuilderStore((s) => s.useCase)
  const setUseCase    = useBuilderStore((s) => s.setUseCase)
  const addPart       = useBuilderStore((s) => s.addPart)
  const partsData     = useCatalogStore((s) => s.parts)
  const gamesData     = useCatalogStore((s) => s.games)

  const game = gamesData.find((g) => g.id === 'fortnite') ?? gamesData[0] ?? null
  const hasCore = Boolean(selectedParts.cpu && selectedParts.gpu)

  const rating = useMemo(
    () => rateBuild(selectedParts, useCase, partsData),
    [selectedParts, useCase, partsData],
  )
  const rows = useMemo(
    () => Object.entries(rating.parts).sort((a, b) => a[1].score - b[1].score),
    [rating],
  )
  const optionsByCat = useMemo(() => {
    const m = {}
    for (const cat of Object.keys(rating.parts)) {
      m[cat] = partUpgradeOptions(selectedParts, useCase, cat, partsData, { game })
    }
    return m
  }, [rating, selectedParts, useCase, partsData, game])

  function chooseUpgrade(cat, partId) {
    const opt = (optionsByCat[cat] ?? []).find((o) => o.toPart.id === partId)
    if (opt) addPart(cat, opt.toPart)
  }

  return (
    <div className={`${PANEL} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-white text-sm font-semibold tracking-wide">Rating</span>
        <select
          aria-label="Use case"
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-xs text-slate-100 px-2 py-1 focus:outline-none focus:border-cyan-400"
        >
          {USE_CASES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
      </div>

      {!hasCore ? (
        <p className="text-gray-500 text-xs">Add a CPU and GPU to rate your build.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`${TELEMETRY} text-3xl font-bold ${scoreText(rating.overall)}`}>{rating.overall}</span>
            <span className="text-xs text-slate-500">/100</span>
            <span className="text-xs text-slate-300 ml-auto">{rating.verdict}</span>
          </div>

          <div className="space-y-1.5">
            {rows.map(([cat, info]) => {
              const opts = optionsByCat[cat] ?? []
              return (
                <div key={cat} className="flex flex-col gap-1 border border-slate-800/60 rounded-sm px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="uppercase text-[10px] text-slate-500 w-14 shrink-0">{CAT_LABEL[cat] ?? cat}</span>
                    <span className="text-sm text-slate-100 flex-1 min-w-0 truncate">{info.part.name}</span>
                    <span className="w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                      <span className={`block h-full ${scoreBar(info.score)}`} style={{ width: `${info.score}%` }} />
                    </span>
                    <span className={`${TELEMETRY} text-sm font-semibold w-7 text-right shrink-0 ${scoreText(info.score)}`}>{info.score}</span>
                    <select
                      aria-label={`Improve ${CAT_LABEL[cat] ?? cat}`}
                      value=""
                      disabled={opts.length === 0}
                      onChange={(e) => chooseUpgrade(cat, e.target.value)}
                      className="bg-slate-950/60 border border-slate-700/70 rounded-sm text-[11px] text-slate-200 px-1.5 py-1 max-w-[8.5rem] focus:outline-none focus:border-cyan-400 disabled:opacity-40"
                    >
                      {opts.length === 0 ? (
                        <option value="">Best available</option>
                      ) : (
                        <>
                          <option value="" disabled>Upgrade…</option>
                          {opts.map((o) => (
                            <option key={o.toPart.id} value={o.toPart.id}>
                              {o.toPart.name} → {o.newScore} (+£{o.extraCost.toFixed(0)}){o.fpsGain != null && o.fpsGain > 0 ? ` · +${o.fpsGain} fps` : ''}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                  {info.reason && <span className="block text-[11px] text-amber-300/80 pl-[3.75rem]">{info.reason}</span>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
