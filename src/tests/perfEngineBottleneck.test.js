import { describe, it, expect } from 'vitest'
import { bottleneckSummary } from '../lib/perfEngine/bottleneck'

const row = (over) => ({
  gameId: 'g', name: 'Game', cpuShare: 0.5, limitedBy: 'balanced',
  gpuOnlyFps: 100, cpuOnlyFps: 100, ...over,
})

describe('bottleneckSummary', () => {
  it('is null with no rows carrying a split', () => {
    expect(bottleneckSummary([])).toBeNull()
    // A measured frame time with no fitted cell has no split to reason about.
    expect(bottleneckSummary([row({ cpuShare: null, limitedBy: null })])).toBeNull()
  })

  it('calls a processor-limited build processor-limited', () => {
    const s = bottleneckSummary([
      row({ gameId: 'a', cpuShare: 0.9, limitedBy: 'cpu', gpuOnlyFps: 200, cpuOnlyFps: 120 }),
      row({ gameId: 'b', cpuShare: 0.85, limitedBy: 'cpu', gpuOnlyFps: 180, cpuOnlyFps: 110 }),
    ])
    expect(s.leaning).toBe('cpu')
    expect(s.cpuLedGames).toBe(2)
    expect(s.nextUpgrade.category).toBe('cpu')
    expect(s.verdict).toMatch(/processor-limited/i)
  })

  it('treats a graphics-led build as healthy, not as a fault', () => {
    const s = bottleneckSummary([
      row({ gameId: 'a', cpuShare: 0.15, limitedBy: 'gpu', gpuOnlyFps: 70, cpuOnlyFps: 240 }),
      row({ gameId: 'b', cpuShare: 0.2, limitedBy: 'gpu', gpuOnlyFps: 90, cpuOnlyFps: 260 }),
    ])
    expect(s.leaning).toBe('gpu')
    expect(s.nextUpgrade.category).toBe('gpu')
    // The wording matters: this is the arrangement you want, and telling
    // someone their perfectly good build is "bottlenecked" is how every other
    // calculator on the internet sells an upgrade nobody needs.
    expect(s.verdict).toMatch(/healthy/i)
  })

  it('picks the worst game, not the average, as the worst case', () => {
    const s = bottleneckSummary([
      row({ gameId: 'fine', name: 'Fine', cpuShare: 0.5, gpuOnlyFps: 100, cpuOnlyFps: 98 }),
      row({ gameId: 'bad', name: 'Bad', cpuShare: 0.95, limitedBy: 'cpu', gpuOnlyFps: 300, cpuOnlyFps: 90 }),
      row({ gameId: 'ok', name: 'Ok', cpuShare: 0.4, gpuOnlyFps: 120, cpuOnlyFps: 130 }),
    ])
    expect(s.worstCase.gameId).toBe('bad')
    // 90 of a possible 300 — 70% of the frame rate lost to the weaker part.
    expect(s.worstCase.lostToWeakerSide).toBe(70)
  })

  it('counts only the games it could actually judge', () => {
    const s = bottleneckSummary([
      row({ gameId: 'a' }),
      row({ gameId: 'b', cpuShare: null, limitedBy: null }),   // no split
      row({ gameId: 'c', gpuOnlyFps: null }),                  // no side figures
    ])
    expect(s.gamesConsidered).toBe(1)
  })

  it('is symmetric — the worst case does not depend on which side is weaker', () => {
    const cpuWeak = bottleneckSummary([
      row({ gpuOnlyFps: 200, cpuOnlyFps: 100, cpuShare: 0.9, limitedBy: 'cpu' }),
    ])
    const gpuWeak = bottleneckSummary([
      row({ gpuOnlyFps: 100, cpuOnlyFps: 200, cpuShare: 0.1, limitedBy: 'gpu' }),
    ])
    expect(cpuWeak.worstCase.lostToWeakerSide).toBe(gpuWeak.worstCase.lostToWeakerSide)
  })
})
