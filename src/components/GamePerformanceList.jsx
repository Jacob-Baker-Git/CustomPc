import useCatalogStore from '../store/useCatalogStore'
import { gameFps } from '../lib/gameFps'

function dotColor(fps) {
  return fps >= 60 ? 'bg-green-500' : fps >= 30 ? 'bg-amber-400' : 'bg-red-500'
}

export default function GamePerformanceList({ cpu, gpu, resolution, quality = 'high' }) {
  const games = useCatalogStore((s) => s.games)
  if (!cpu || !gpu) return null
  const rows = games
    .map((game) => ({ game, fps: gameFps(cpu, gpu, resolution, game, quality) }))
    .sort((a, b) => b.fps - a.fps)

  return (
    <div>
      {rows.map(({ game, fps }) => (
        <div key={game.id} className="flex items-center py-1.5 border-t border-slate-800/50">
          <span className={`w-2 h-2 rounded-full mr-2.5 shrink-0 ${dotColor(fps)}`} />
          <span className="flex-1 text-sm text-slate-100">
            {game.name}
            {game.fpsCap && fps >= game.fpsCap && (
              <span className="ml-1.5 text-[10px] text-slate-500">engine cap</span>
            )}
          </span>
          <span className="font-mono text-sm text-slate-300">{fps}</span>
        </div>
      ))}
    </div>
  )
}
