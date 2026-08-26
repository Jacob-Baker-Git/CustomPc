import { useMemo, useState } from 'react'
import { ChevronDown, Zap } from 'lucide-react'
import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { rateBuild, partUpgradeOptions, pickRecommendation } from '../lib/partRatings'
import ScoreInfo from './ScoreInfo'
import { TELEMETRY, BTN_PRIMARY } from '../lib/uiTokens'
import RamBox from './RamBox'
import PartThumb from './art/PartThumb'
import { FPS_CAVEAT } from '../lib/siteContent'

const CAT_LABEL = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage', psu: 'PSU',
  cooler: 'Cooler', motherboard: 'Motherboard', case: 'Case', fans: 'Fans',
}
const scoreText = (s) => (s >= 80 ? 'text-good' : s >= 50 ? 'text-ok' : 'text-bad')
const scoreBar  = (s) => (s >= 80 ? 'bg-good' : s >= 50 ? 'bg-ok' : 'bg-bad')

// The Build-tab CustomPC score: overall /100 for the use case chosen by the
// chips above it, plus one row per part where a dropdown lists in-catalog
// upgrades that raise that part's score. Picking one swaps the live component.
// Any part being held back also carries a one-line headline that expands into
// the reasoning behind it.
//
// The old standalone "Upgrade suggestion" box lives here now, on the worst part
// rather than on whatever moved FPS most: a separate panel recommending a GPU
// while this one said the storage was the weak link was two features arguing.
export default function BuildRatingPanel() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const useCase       = useBuilderStore((s) => s.useCase)
  const budget        = useBuilderStore((s) => s.budget)
  const spent         = useBuilderStore(selTotalSpent)
  const addPart       = useBuilderStore((s) => s.addPart)
  const partsData     = useCatalogStore((s) => s.parts)
  const gamesData     = useCatalogStore((s) => s.games)
  const [openWhy, setOpenWhy] = useState(null)

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
      m[cat] = partUpgradeOptions(selectedParts, useCase, cat, partsData, { game, limit: 6 })
    }
    return m
  }, [rating, selectedParts, useCase, partsData, game])

  // Reuses the options already computed for the dropdowns, so the recommendation
  // costs nothing extra.
  const tip = useMemo(
    () => pickRecommendation(rating, optionsByCat, budget > 0 ? budget - spent : Infinity),
    [rating, optionsByCat, budget, spent],
  )

  function chooseUpgrade(cat, partId) {
    const opt = (optionsByCat[cat] ?? []).find((o) => o.toPart.id === partId)
    if (opt) addPart(cat, opt.toPart)
  }

  return (
    <RamBox seated={hasCore} open={openWhy !== null}>
      <span className="flex items-center gap-2 text-ink text-sm font-semibold mb-3">
        Your CustomPC score
        <ScoreInfo />
      </span>

      {!hasCore ? (
        <p className="text-muted text-xs">Add a CPU and GPU to rate your build.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className={`font-display text-4xl font-extrabold tabular-nums leading-none ${scoreText(rating.overall)}`}>{rating.overall}</span>
            <span className="text-xs text-faint">/100</span>
            <span className={`text-xs font-semibold ml-auto ${scoreText(rating.overall)}`}>{rating.verdict}</span>
          </div>

          {tip && (
            <div className="mb-4 rounded-lg border border-brass bg-gold-soft px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={13} className="text-brass shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-brass">Best next move</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Your weakest part is the <span className="uppercase">{CAT_LABEL[tip.category] ?? tip.category}</span>.
                {' '}Swapping it for <span className="text-ink font-semibold">{tip.toPart.name}</span> takes it from{' '}
                <span className={TELEMETRY}>{tip.fromScore}</span> to <span className={`${TELEMETRY} text-good font-semibold`}>{tip.toScore}</span>
                {' '}for <span className={TELEMETRY}>{tip.extraCost <= 0 ? 'no extra cost' : `+£${tip.extraCost.toFixed(0)}`}</span>
                {tip.fpsGain > 0 && <> · <span className={`${TELEMETRY} text-good`}>+{tip.fpsGain} fps</span></>}.
              </p>
              <button
                onClick={() => addPart(tip.category, tip.toPart)}
                className={`mt-2.5 w-full ${BTN_PRIMARY} text-xs py-1.5 rounded-lg transition-colors`}
              >
                Apply this upgrade
              </button>
            </div>
          )}

          <div className="space-y-2">
            {rows.map(([cat, info]) => {
              const opts = optionsByCat[cat] ?? []
              const label = CAT_LABEL[cat] ?? cat
              const open = openWhy === cat
              return (
                <div key={cat} className="flex gap-3 border border-line rounded-lg px-3 py-2.5">
                  {/* The picture anchors the row. Without it every row opened
                      with a 10px grey word, so nine rows read as nine
                      identical paragraphs and the eye had nothing to catch on. */}
                  <PartThumb category={cat} seed={info.part.id} size="sm" className="mt-0.5" />

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {/* The score moves up here, beside the category, where it is
                        the row's headline. It used to sit in the middle of the
                        second line between a stub of a bar and a dropdown,
                        which is the one place on the row nothing looks. */}
                    <div className="flex items-baseline gap-2">
                      <span className="uppercase text-[10px] tracking-wide text-muted">{label}</span>
                      <span className={`${TELEMETRY} ml-auto text-base font-bold leading-none ${scoreText(info.score)}`}>{info.score}</span>
                    </div>

                    <span className="text-sm text-ink truncate leading-tight">{info.part.name}</span>

                    {/* Full width, not the 56px stub it was. A bar that short
                        cannot show the difference between 71 and 88, which is
                        the only comparison this row exists to make. */}
                    <span className="block h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <span className={`block h-full rounded-full ${scoreBar(info.score)}`} style={{ width: `${info.score}%` }} />
                    </span>

                    {/* w-full now the select owns its own line. It kept a
                        max-w-[10rem] while it shared a row with the bar and the
                        score; on its own that just leaves dead space, and a
                        <select> is sized by its widest <option>, so the cap was
                        truncating long part names in the list for nothing. */}
                    <select
                      aria-label={`Improve ${label}`}
                      value=""
                      disabled={opts.length === 0}
                      onChange={(e) => chooseUpgrade(cat, e.target.value)}
                      className="bg-surface-2 border border-line rounded-lg text-[11px] text-muted px-1.5 py-1 w-full min-w-0 focus:outline-none focus:border-brass disabled:opacity-40"
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
                    {info.reason && (
                      <>
                        <button
                          onClick={() => setOpenWhy(open ? null : cat)}
                          aria-expanded={open}
                          aria-label={`Why is the ${label} rated ${info.score}?`}
                          className="flex items-start gap-1 text-left text-[11px] text-ok hover:text-ink transition-colors"
                        >
                          <span>{info.reason}</span>
                          <ChevronDown size={13} aria-hidden="true" className={`shrink-0 mt-px transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && info.detail && (
                          <p className="pr-1 pb-0.5 text-[11px] leading-relaxed text-muted">{info.detail}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* The "+N fps" gains above are modelled, same as the frame-rate list. */}
          <p className="mt-3 text-[11px] text-muted leading-relaxed">{FPS_CAVEAT}</p>
        </>
      )}
    </RamBox>
  )
}
