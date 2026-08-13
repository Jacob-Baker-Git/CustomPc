import { describe, it, expect } from 'vitest'
import { estimateBuildPerformance } from '../lib/perfEngine'
import model from '../data/perfModel.json'
import games from '../data/perfGames.json'
import parts from '../data/partsData.json'

const list = Array.isArray(parts) ? parts : parts.parts
const pick = (id) => list.find((p) => p.id === id)
const gameList = Array.isArray(games) ? games : games.games

const report = (cpuId, gpuId, resolution = '1440p') => estimateBuildPerformance({
  parts: { cpu: pick(cpuId), gpu: pick(gpuId) }, resolution, model, games: gameList,
})

describe('every answered row carries a complete basis', () => {
  const rows = report('cpu-ryzen-5-7600', 'gpu-rtx-4070').games.filter((r) => r.avgFps > 0)

  it('answers at all, so the assertions below are not vacuous', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('gives every answered row a bound and a caveats array', () => {
    for (const r of rows) {
      expect(['point', 'upper'], `${r.rowId}`).toContain(r.bound)
      expect(Array.isArray(r.caveats), `${r.rowId}`).toBe(true)
    }
  })

  it('marks a point-estimate row as a point, not an upper bound', () => {
    for (const r of rows.filter((x) => x.basis === 'modelled')) {
      expect(r.bound, `${r.rowId}`).toBe('point')
    }
  })

  it('leaves an unanswered row alone', () => {
    const none = report('cpu-ryzen-5-7600', 'gpu-rtx-4070').games.find((r) => r.basis === 'none')
    expect(none.avgFps).toBeNull()
    expect(none.bound).toBe('point')
    expect(none.caveats).toEqual([])
  })
})
