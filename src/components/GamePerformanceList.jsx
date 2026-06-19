import gamesData from '../data/gamesData.json'
import { gameFps } from '../lib/gameFps'

function dotColor(fps) {
  return fps >= 60 ? 'bg-green-500' : fps >= 30 ? 'bg-amber-400' : 'bg-red-500'
}

export default function GamePerformanceList({ cpu, gpu, resolution }) {
  if (!cpu || !gpu) return null
  const rows = gamesData
    .map((game) => ({ game, fps: gameFps(cpu, gpu, resolution, game) }))
    .sort((a, b) => b.fps - a.fps)

  return (
    <div>
      {rows.map(({ game, fps }) => (
        <div key={game.id} className="flex items-center py-1.5 border-t border-slate-800/50">
          <span className={`w-2 h-2 rounded-full mr-2.5 shrink-0 ${dotColor(fps)}`} />
          <span className="flex-1 text-sm text-slate-100">{game.name}</span>
          <span className="font-mono text-sm text-slate-300">{fps}</span>
        </div>
      ))}
    </div>
  )
}
