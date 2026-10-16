import { describe, it, expect } from 'vitest'
import { perfFoldSummaries } from '../lib/perfFoldSummaries'

const base = {
  report: { bottleneck: { leaning: 'gpu', gpuLedGames: 5, cpuLedGames: 0, gamesConsidered: 5 } },
  power: { gamingW: 132, psuWattage: 750, psuHeadroomPct: 58 },
  memory: { capacityGb: 8, type: 'DDR4', channels: 'single' },
  answered: 53,
  total: 60,
}

describe('perfFoldSummaries', () => {
  it('heads each fold with its key numbers', () => {
    expect(perfFoldSummaries(base)).toEqual({
      holding: 'Graphics-limited in 5 of 5 games',
      power: '132 W gaming · supply has 58% spare',
      hardware: '8 GB DDR4 · one stick',
      games: '53 of 60 games answered',
    })
  })

  it('says when no supply is chosen', () => {
    const s = perfFoldSummaries({ ...base, power: { gamingW: 132, psuWattage: null, psuHeadroomPct: null } })
    expect(s.power).toBe('132 W gaming · no supply chosen')
  })

  it('says when the supply falls short', () => {
    const s = perfFoldSummaries({ ...base, power: { gamingW: 600, psuWattage: 450, psuHeadroomPct: -12 } })
    expect(s.power).toBe('600 W gaming · supply is 12% short')
  })

  it('says when there is nothing to call a bottleneck from', () => {
    expect(perfFoldSummaries({ ...base, report: null }).holding).toBe('Needs benchmark data')
  })

  it('names a processor-limited build', () => {
    const report = { bottleneck: { leaning: 'cpu', gpuLedGames: 1, cpuLedGames: 4, gamesConsidered: 5 } }
    expect(perfFoldSummaries({ ...base, report }).holding).toBe('Processor-limited in 4 of 5 games')
  })

  it('reads dual-channel memory and terabyte capacities', () => {
    const s = perfFoldSummaries({ ...base, memory: { capacityGb: 32, type: 'DDR5', channels: 'dual' } })
    expect(s.hardware).toBe('32 GB DDR5 · dual channel')
  })

  it('says when no memory is chosen', () => {
    expect(perfFoldSummaries({ ...base, memory: null }).hardware).toBe('No memory chosen')
  })
})
