import useCatalogStore from '../store/useCatalogStore'
import { gameFps } from '../lib/gameFps'

function dotColor(fps) {
  return fps >= 60 ? 'bg-good' : fps >= 30 ? 'bg-ok' : 'bg-bad'
}

export default function GamePerformanceList({ cpu, gpu, resolution, quality = 'high', limit = Infinity }) {
  const games = useCatalogStore((s) => s.games)
  if (!cpu || !gpu) return null
  const rows = games
    .map((game) => ({ game, fps: gameFps(cpu, gpu, resolution, game, quality) }))
    .sort((a, b) => b.fps - a.fps)
    .slice(0, limit)

  return (
    <div>
      {rows.map(({ game, fps }) => (
        <div key={game.id} className="flex items-center py-1.5 border-t border-line">
          <span className={`w-2 h-2 rounded-full mr-2.5 shrink-0 ${dotColor(fps)}`} />
          <span className="flex-1 text-sm text-ink">
            {game.name}
            {game.fpsCap && fps >= game.fpsCap && (
              <span className="ml-1.5 text-[10px] text-muted">engine cap</span>
            )}
          </span>
          <span className="font-mono text-sm text-muted">{fps}</span>
        </div>
      ))}
    </div>
  )
}
