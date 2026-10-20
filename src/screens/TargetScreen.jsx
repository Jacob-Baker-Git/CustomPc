import { useState } from 'react'
import useBuilderStore from '../store/useBuilderStore'
import useCatalogStore from '../store/useCatalogStore'
import perfModel from '../data/perfModel.json'
import { buildForGame, findPreset, gameById, presetKey } from '../lib/gameTargetBuilder'
import { buildCards } from '../lib/buildCards'
import GameSettingsFields from '../components/GameSettingsFields'
import { CATEGORIES, categoryLabel } from '../lib/categories'
import { focusChange, formatDelta } from '../lib/showroomSlots'
import ShowroomStill from '../components/showroom/ShowroomStill'
import CropFrame from '../components/showroom/CropFrame'
import PartPictogram from '../components/showroom/PartPictogram'
import { BTN_PRIMARY } from '../lib/uiTokens'
import { useIsDesktop } from '../hooks/useIsDesktop'

const fpsText = (o) => `${o.bound === 'upper' ? 'up to ' : ''}${o.fps} fps`

const LABEL = 'text-[12px] uppercase tracking-wider text-muted'

// Card 1 shows the whole build; each later card zooms on the part type that
// changed most against the card to its left (spec 2026-10-20, "show what
// changed"). Parts without an anchor in the still get the whole picture.
function CardShow({ card, prevCard, chip }) {
  const { parts } = card.option
  if (!prevCard) {
    return (
      <ShowroomStill parts={parts} ids={[]} frame="4 / 3" chip={chip}>
        <div className={LABEL}>Base build</div>
        <div className="text-sm font-semibold text-ink">{[parts.cpu?.name, parts.gpu?.name].filter(Boolean).join(' + ')}</div>
      </ShowroomStill>
    )
  }
  const f = focusChange(prevCard.option, card.option, card.changed)
  if (!f) return <ShowroomStill parts={parts} ids={[]} frame="4 / 3" chip={chip} />
  return (
    <ShowroomStill parts={parts} ids={[]} frame="4 / 3" chip={chip} zoom={f.anchored ? { id: f.id, scale: 2.2 } : undefined}>
      <div className="text-sm font-semibold text-ink">
        {`${categoryLabel(f.id)} · ${f.part?.name ?? 'removed'} · `}
        {/* nowrap: UAX#14 lets a line break between + and £. */}
        <span className="whitespace-nowrap">{formatDelta(f.delta)}</span>
      </div>
      {f.others.length > 0 && (
        <div className="font-mono text-[12px] text-muted">{`${f.others.map(categoryLabel).join(', ')} also changed`}</div>
      )}
    </ShowroomStill>
  )
}

// One answer: the frame rate, the price and the button together, so the
// choice is made on one screen; the parts that make it up fold underneath
// (spec 2026-10-16). Side by side on desktop with the parts open; a part that
// differs from the answer to its left is marked with a brass dot, so the
// columns say what the extra money buys (spec 2026-10-17). The Best value
// card is the recommended one (spec 2026-10-20).
function BuildOption({ card, prevCard, index, count, maxFps, open, onUse }) {
  const { option } = card
  const parts = CATEGORIES.filter((c) => option.parts[c.id])
  const rec = card.kind === 'middle'
  return (
    <section className={`py-6 ${rec ? 'relative z-10 border border-brass bg-surface px-4 lg:-translate-y-2 lg:px-6' : 'border-b border-line lg:border-b-0'}`}>
      <CropFrame className="mb-5">
        <CardShow card={card} prevCard={prevCard} chip={`0${index + 1} / 0${count}`} />
      </CropFrame>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm">
          <span className="font-semibold text-ink">{card.title}</span>
          {card.also && <span className="text-muted"> · {card.also}</span>}
        </h2>
        {rec && <span className="bg-brass px-2 py-0.5 font-mono text-[12px] text-accent-ink">Recommended</span>}
      </div>
      <div className="mt-4 flex items-baseline gap-6">
        <div>
          <div className={LABEL}>{option.bound === 'upper' ? 'up to' : 'frame rate'}</div>
          <div className="font-mono text-5xl font-bold text-ink">
            {option.fps}<span className="ml-1 text-base text-muted">fps</span>
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className={LABEL}>price</div>
          <div className="font-mono text-4xl font-bold text-ink">£{option.total.toFixed(0)}</div>
        </div>
      </div>
      <div className="mt-3 h-1 bg-surface-2"><div className="h-1 bg-brass" style={{ width: `${Math.min(100, (option.fps / maxFps) * 100)}%` }} /></div>
      {card.step && <p className="mt-3 font-mono text-[12px] text-brass">{card.step}</p>}
      {card.overBudget && <p className="mt-1 text-[13px] text-bad">over budget</p>}
      <button
        onClick={onUse}
        className={`mt-4 min-h-11 px-4 text-sm ${rec ? BTN_PRIMARY : 'border border-line font-semibold text-ink hover:border-brass'}`}
      >
        Use this build
      </button>
      <details className="mt-5" open={open}>
        <summary className={`${LABEL} cursor-pointer py-2 hover:text-ink`}>{parts.length} parts</summary>
        <ul className="mt-1 text-sm">
          {parts.map((c) => {
            const changed = card.changed.has(c.id)
            return (
              <li key={c.id} data-changed={changed ? 'true' : undefined} className="flex items-center gap-3 border-t border-line py-2">
                <PartPictogram id={c.id} className={changed ? 'text-brass' : ''} />
                <div className="min-w-0 flex-1">
                  <div className={LABEL}>{c.label}</div>
                  <div className={changed ? 'text-ink' : 'text-muted'}>{option.parts[c.id].name}</div>
                </div>
                {changed && <span className="h-2 w-2 shrink-0 rounded-full bg-brass"><span className="sr-only">changed</span></span>}
              </li>
            )
          })}
        </ul>
      </details>
    </section>
  )
}

export default function TargetScreen() {
  const target = useBuilderStore((s) => s.target)
  const setTarget = useBuilderStore((s) => s.setTarget)
  const storeBudget = useBuilderStore((s) => s.budget)
  const resolution = useBuilderStore((s) => s.resolution)
  const parts = useCatalogStore((s) => s.parts)
  const desktop = useIsDesktop()
  const [fps, setFps] = useState(String(target.fps))
  const [budget, setBudgetText] = useState(String(storeBudget > 0 ? storeBudget : 1000))
  const [result, setResult] = useState(null)
  const game = gameById(target.gameId)
  const fpsNum = Number(fps)
  const budgetNum = Number(budget)
  const ready = Boolean(game) && fpsNum > 0 && budgetNum > 0
  const preset = game ? findPreset(game, target.presetKey) : null
  // Results answer one set of inputs; once any changes they are hidden rather
  // than left under a "Use this build" button for settings they do not match.
  const inputs = game ? `${game.id}|${presetKey(preset)}|${resolution}|${fpsNum}|${budgetNum}` : null
  const shown = result?.inputs === inputs ? result : null

  function find() {
    setTarget({ fps: fpsNum })
    useBuilderStore.getState().setBudget(budgetNum)
    setResult({
      inputs, budget: budgetNum, fps: fpsNum, game, preset, resolution,
      ...buildForGame({ game, preset, resolution,
                        targetFps: fpsNum, budget: budgetNum, parts, model: perfModel }),
    })
  }

  function use(option) {
    const s = useBuilderStore.getState()
    s.setBuild(option.parts)
    s.setPath('game')
    s.setFlow('builder', 'peripherals')
  }

  const cards = shown && !shown.noData ? buildCards(shown, { budget: shown.budget, fps: shown.fps }) : []

  const maxFps = Math.max(1, ...cards.map((c) => c.option.fps))
  const cell = 'flex min-w-0 flex-col justify-center gap-1 border-b border-r border-line px-4 py-3'
  const input = 'w-full border-0 bg-transparent p-0 py-1 text-sm font-medium normal-case tracking-normal text-ink'

  return (
    <div>
      <h1 className="font-wide text-3xl font-extrabold lg:text-5xl">Build for a game</h1>
      {/* One bordered row of inputs on desktop, a two-column grid on a phone. */}
      <div className="mt-6 grid grid-cols-2 border-l border-t border-line bg-surface lg:flex">
        <GameSettingsFields cell={`${cell} lg:flex-1`} input={input} />
        <label className={`${cell} ${LABEL} lg:w-36`}>
          Target FPS
          <input type="number" min="1" value={fps} onChange={(e) => setFps(e.target.value)} className={input} />
        </label>
        <label className={`${cell} ${LABEL} lg:w-36`}>
          Budget (£)
          <input type="number" min="1" value={budget} onChange={(e) => setBudgetText(e.target.value)} className={input} />
        </label>
        <div className={`${cell} col-span-2 lg:col-span-1`}>
          <button onClick={find} disabled={!ready}
                  className={`${BTN_PRIMARY} min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40`}>
            Find builds
          </button>
        </div>
      </div>
      {game && !ready && (
        <p className="mt-2 text-[12px] text-muted">Enter a frame rate and a budget above zero.</p>
      )}

      {!shown && desktop && (
        <p className="mt-8 text-sm text-muted">Pick a game, a frame rate and a budget, then Find builds.</p>
      )}

      {shown && (
        <div className="mt-8 flex flex-col gap-3">
          <p className={LABEL}>{shown.game.name} · {shown.resolution} · {shown.preset.label} · target {shown.fps} fps</p>
          {shown.noData ? (
            <p className="text-sm text-muted">No benchmark data for {shown.game.name} at these settings yet, so there is nothing to build towards.</p>
          ) : (
            <>
              <div className="grid items-start border-t border-line pt-4 lg:grid-cols-3 lg:gap-6">
                {/* The no-value line stands where the Middle answer would. */}
                {cards.flatMap((card, i) => [
                  <BuildOption key={card.kind} card={card} prevCard={cards[i - 1]} index={i} count={cards.length}
                               maxFps={maxFps} open={desktop} onUse={() => use(card.option)} />,
                  card.kind === 'cheapest' && shown.noValueStep && (
                    <p key="no-value" className="border-b border-line py-6 text-sm text-muted lg:border-b-0">
                      Nothing above the cheapest build is worth the extra money.
                    </p>
                  ),
                ])}
              </div>
              {!shown.best && <p className="text-sm text-muted">No complete build fits £{shown.budget.toLocaleString('en-GB')}.</p>}
              {shown.unreachable && (
                <p className="text-sm text-muted">
                  No build in the catalogue reaches {shown.fps} fps in {shown.game.name} at these settings.
                  {/* No fastest when no pair could be made into a whole PC. */}
                  {shown.fastest && <> The fastest manages {fpsText(shown.fastest)} for £{shown.fastest.total.toFixed(0)}.</>}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
