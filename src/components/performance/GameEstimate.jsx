import { useMemo } from 'react'
import useBuilderStore from '../../store/useBuilderStore'
import perfModel from '../../data/perfModel.json'
import { findPreset, fpsFor, gameById } from '../../lib/gameTargetBuilder'
import { refreshFit } from '../../lib/refreshFit'
import GameSettingsFields from '../GameSettingsFields'
import { BASIS_LABEL, CAVEAT_TEXT } from './basisText'
import { TELEMETRY } from '../../lib/uiTokens'
import Tag from '../ui/Tag'

const LIMIT = { cpu: 'the processor', gpu: 'the graphics card', balanced: 'neither part; the two are balanced' }
const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }

// The frame rate set against the refresh rates monitors ship at, so "75 fps"
// reads as "keeps up with a 60 Hz screen". The bar runs to the average; the
// gold mark is the 1% lows. A ceiling ("up to") fades out at its end rather
// than stopping hard, because the real figure can only be lower.
function RefreshMeter({ row }) {
  const ceiling = row.bound === 'upper'
  const fit = refreshFit(row.avgFps, row.lowFps, { ceiling })
  const label = `Frame rate on a scale of 0 to ${fit.scaleMax} fps: ${ceiling ? 'up to ' : ''}${row.avgFps} fps on average`
    + (row.lowFps != null ? `, ${row.lowFps} fps in the 1% lows.` : '.')

  return (
    <div className="min-w-0">
      <div role="img" aria-label={label} className="relative pt-1 pb-6">
        <div className="relative h-3 rounded-full bg-ground border border-line">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-brass motion-safe:transition-[width] motion-safe:duration-500"
            style={{
              width: `${fit.avgPct}%`,
              ...(ceiling && { backgroundImage: 'linear-gradient(to right, var(--brass) 65%, transparent)', backgroundColor: 'transparent' }),
            }}
          />
          {fit.ticks.map((t) => (
            <span key={t} aria-hidden="true" className="absolute -inset-y-1 w-px bg-line-strong"
                  style={{ left: `${(100 * t) / fit.scaleMax}%` }} />
          ))}
          {fit.lowPct != null && (
            <span aria-hidden="true" className="absolute -inset-y-1.5 w-1 -ml-0.5 rounded-sm bg-gold motion-safe:transition-[left] motion-safe:duration-500"
                  style={{ left: `${fit.lowPct}%` }} />
          )}
        </div>
        {fit.ticks.map((t, i) => (
          <span key={t} aria-hidden="true"
                className={`absolute bottom-0 ${TELEMETRY} text-[11px] text-faint ${i === fit.ticks.length - 1 && t === fit.scaleMax ? '-translate-x-full' : '-translate-x-1/2'}`}
                style={{ left: `${(100 * t) / fit.scaleMax}%` }}>
            {fit.tickLabels[i]}
          </span>
        ))}
      </div>
      <p className="mt-1 text-sm text-ink">{fit.verdict}</p>
    </div>
  )
}

export default function GameEstimate() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const resolution = useBuilderStore((s) => s.resolution)
  const target = useBuilderStore((s) => s.target)
  const game = gameById(target.gameId)
  const preset = game ? findPreset(game, target.presetKey) : null
  const hasCore = Boolean(selectedParts.cpu && selectedParts.gpu)

  const row = useMemo(
    () => (hasCore && game ? fpsFor(selectedParts, game, resolution, preset, perfModel) : null),
    [hasCore, game, preset, selectedParts, resolution],
  )
  const caveats = row?.caveats?.map((c) => CAVEAT_TEXT[c]).filter(Boolean) ?? []

  return (
    <section aria-labelledby="estimate-h" className="pt-2">
      <h2 id="estimate-h" className="mb-4 font-wide text-2xl font-extrabold text-ink">What will this build get?</h2>
      <GameSettingsFields />
      <div className="mt-6" aria-live="polite">
        {!hasCore ? (
          <p className="text-sm text-muted">Pick a CPU and a graphics card to estimate frame rates.</p>
        ) : !game ? (
          <p className="text-sm text-muted">Search for a game to see what this build gets in it.</p>
        ) : row?.avgFps == null ? (
          <p className="max-w-[68ch] text-sm text-muted">
            No benchmark data for this build in {game.name} at these settings yet. We only show figures we can
            trace to a measurement or a model fitted to one, so there is no number here rather than a guess.
          </p>
        ) : (
          <>
            <div className="grid gap-x-10 gap-y-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <div>
                <Tag>{preset.label.toLowerCase()} / {RES_LABEL[resolution] ?? resolution}</Tag>
                <p className="mt-1 font-wide text-xl font-extrabold text-ink">{game.name}</p>
                <p data-testid="estimate-fps" className="mt-1 flex items-baseline gap-2 font-display text-ink">
                  {row.bound === 'upper' && <span className="text-base font-semibold text-muted">up to</span>}
                  {row.bound === 'upper' && ' '}
                  <span className="font-wide text-7xl font-black leading-none tabular-nums text-ink">{row.avgFps}</span>
                  {' '}
                  <span className="font-wide text-2xl font-bold text-muted">fps</span>
                </p>
                {row.lowFps != null && (
                  <p className="mt-2 text-sm text-muted">
                    <span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-1 rounded-xs bg-gold align-middle" />
                    1% lows <span className={`${TELEMETRY} text-ink`}>{row.lowFps} fps</span>
                  </p>
                )}
              </div>
              <RefreshMeter row={row} />
            </div>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-line pt-4 text-xs text-muted">
              <p>
                {row.limitedBy
                  ? <>Held back by <span className="text-ink">{LIMIT[row.limitedBy] ?? row.limitedBy}</span>.</>
                  : 'Which part holds it back is not modelled for this game.'}
              </p>
              <details className="group">
                <summary className="cursor-pointer text-brass hover:underline">How this figure is worked out</summary>
                <div className="mt-2 max-w-[68ch] space-y-1.5 leading-relaxed">
                  <p>Basis: <span className="text-ink">{BASIS_LABEL[row.basis] ?? row.basis}</span>.</p>
                  {caveats.map((c) => <p key={c}>{c}</p>)}
                </div>
              </details>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
