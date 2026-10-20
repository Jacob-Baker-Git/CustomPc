import { useMemo } from 'react'
import { Zap } from 'lucide-react'
import useBuilderStore, { selTotalSpent } from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import { rateBuild, partUpgradeOptions, pickRecommendation } from '../lib/partRatings'
import ScoreInfo from './ScoreInfo'
import { TELEMETRY, BTN_PRIMARY } from '../lib/uiTokens'
import Block from './ui/Block'
import { gbp } from '../lib/money'

const CAT_LABEL = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', storage: 'Storage', psu: 'PSU',
  cooler: 'Cooler', motherboard: 'Motherboard', case: 'Case', fans: 'Fans',
}
const scoreText = (s) => (s >= 80 ? 'text-good' : s >= 50 ? 'text-ok' : 'text-bad')

// The Summary-tab CustomPC score: overall /100 for the use case chosen by the
// chips above it, plus the one "Best next move" on the worst part. The per-part
// score list was removed (user, 2026-10-17): the build list sits under this
// panel instead, and one recommendation says more than nine rows of bars.
export default function BuildRatingPanel() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const useCase       = useBuilderStore((s) => s.useCase)
  const budget        = useBuilderStore((s) => s.budget)
  const spent         = useBuilderStore(selTotalSpent)
  const addPart       = useBuilderStore((s) => s.addPart)
  const partsData     = useCatalogStore((s) => s.parts)

  const hasCore = Boolean(selectedParts.cpu && selectedParts.gpu)

  const rating = useMemo(
    () => rateBuild(selectedParts, useCase, partsData),
    [selectedParts, useCase, partsData],
  )
  const optionsByCat = useMemo(() => {
    const m = {}
    for (const cat of Object.keys(rating.parts)) {
      m[cat] = partUpgradeOptions(selectedParts, useCase, cat, partsData, { limit: 6 })
    }
    return m
  }, [rating, selectedParts, useCase, partsData])

  // Every part's upgrade options, scanned for the one best move.
  const tip = useMemo(
    () => pickRecommendation(rating, optionsByCat, budget > 0 ? budget - spent : Infinity),
    [rating, optionsByCat, budget, spent],
  )

  // The use-case reasons behind the score ("16GB, and Streaming is happier with
  // 32GB+"), worst first. Without the per-part list these are the only place
  // the chips visibly change anything but the number.
  const heldBack = Object.entries(rating.parts)
    .filter(([, p]) => p.reason)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 3)

  return (
    <Block>
      <span className="flex items-center gap-2 text-ink text-sm font-semibold mb-3">
        Your CustomPC score
        <ScoreInfo />
      </span>

      {!hasCore ? (
        <p className="text-muted text-xs">Add a CPU and GPU to rate your build.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className={`font-wide text-5xl font-black tabular-nums leading-none ${scoreText(rating.overall)}`}>{rating.overall}</span>
            <span className="text-xs text-faint">/100</span>
            <span className={`text-xs font-semibold ml-auto ${scoreText(rating.overall)}`}>{rating.verdict}</span>
          </div>

          {tip && (
            // A brass rule down the left, not a filled box: the one accent marks
            // it, the hairline look stays.
            <div className="mb-4 border-l-2 border-brass py-1 pl-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={13} className="text-brass shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-brass">Best next move</span>
              </div>
              <p className="text-[12px] text-muted leading-relaxed">
                Your weakest part is the <span className="uppercase">{CAT_LABEL[tip.category] ?? tip.category}</span>.
                {' '}Swapping it for <span className="text-ink font-semibold">{tip.toPart.name}</span> takes it from{' '}
                <span className={TELEMETRY}>{tip.fromScore}</span> to <span className={`${TELEMETRY} text-good font-semibold`}>{tip.toScore}</span>
                {' '}for <span className={TELEMETRY}>{tip.extraCost <= 0 ? 'no extra cost' : `+${gbp(tip.extraCost)}`}</span>.
              </p>
              <button
                onClick={() => addPart(tip.category, tip.toPart)}
                className={`mt-2.5 w-full ${BTN_PRIMARY} text-xs py-1.5 rounded-lg transition-colors`}
              >
                Apply this upgrade
              </button>
            </div>
          )}

          {heldBack.length > 0 && (
            <div className="mb-4">
              <span className="text-[12px] uppercase tracking-wider text-muted">Holding the score back</span>
              <ul className="mt-1">
                {heldBack.map(([cat, p]) => (
                  <li key={cat} className="flex gap-2 border-t border-line py-1.5 text-[12px] leading-relaxed">
                    <span className={`${TELEMETRY} w-7 shrink-0 font-bold ${scoreText(p.score)}`}>{p.score}</span>
                    <span className="text-muted"><span className="uppercase text-ink">{CAT_LABEL[cat] ?? cat}</span> · {p.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </>
      )}
    </Block>
  )
}
