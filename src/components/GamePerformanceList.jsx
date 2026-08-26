import useCatalogStore from '../store/useCatalogStore'
import { gameFps } from '../lib/gameFps'
import { FPS_CAVEAT } from '../lib/siteContent'
import { TELEMETRY } from '../lib/uiTokens'
import GameArt from './art/GameArt'
import { genreFor } from '../lib/gameGenres'

const band = (fps) => (fps >= 60 ? 'good' : fps >= 30 ? 'ok' : 'bad')

const BAR = { good: 'bg-good', ok: 'bg-ok', bad: 'bg-bad' }
const TEXT = { good: 'text-good', ok: 'text-ok', bad: 'text-bad' }

// The bar is proportional up to 144 and pinned there above it. Scaling to the
// fastest row instead would make the same build look different depending on
// which games happened to be in the list, and a 400 fps esports title would
// flatten every other bar to a stub.
const FULL_SCALE = 144

export default function GamePerformanceList({ cpu, gpu, resolution, quality = 'high', limit = Infinity }) {
  const games = useCatalogStore((s) => s.games)
  if (!cpu || !gpu) return null

  const rows = games
    .map((game) => ({ game, fps: gameFps(cpu, gpu, resolution, game, quality) }))
    .sort((a, b) => b.fps - a.fps)
    .slice(0, limit)

  return (
    <div>
      <ul className="space-y-1">
        {rows.map(({ game, fps }) => {
          const tone = band(fps)
          return (
            <li
              key={game.id}
              data-game={game.id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2 transition-colors"
            >
              {/* A cover plate rather than a coloured dot. The dot said one
                  thing (fast/slow) that the number beside it already said; the
                  plate says WHICH GAME, which is what the eye is actually
                  hunting for when it scans back up a list of sixty. */}
              <GameArt name={game.name} genre={genreFor(game)} seed={game.id} className="w-8 h-8 shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm text-ink truncate">{game.name}</span>
                  {game.fpsCap && fps >= game.fpsCap && (
                    <span className="text-[10px] text-muted shrink-0">engine cap</span>
                  )}
                </div>
                {/* The bar carries the comparison, the figure carries the
                    value. A column of bare numbers makes the reader do the
                    ranking themselves, which is the spreadsheet problem. */}
                <div className="mt-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${BAR[tone]}`}
                    style={{ width: `${Math.min(100, (fps / FULL_SCALE) * 100)}%` }}
                  />
                </div>
              </div>

              <span className={`${TELEMETRY} text-sm font-semibold shrink-0 w-12 text-right ${TEXT[tone]}`}>
                {fps}
              </span>
              <span className="text-[10px] text-faint shrink-0 -ml-1.5">fps</span>
            </li>
          )
        })}
      </ul>
      {/* text-muted, not text-faint: faint is 3.9:1 on this background and
          fails WCAG AA for body text. A disclaimer nobody can read is not a
          disclaimer. Same reasoning everywhere legal copy appears. */}
      <p className="mt-3 text-[11px] text-muted leading-relaxed">{FPS_CAVEAT}</p>
    </div>
  )
}
