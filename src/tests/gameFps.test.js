import { describe, it, expect } from 'vitest'
import { gameFps } from '../lib/gameFps'
import { estimateFps } from '../lib/fpsEstimate'
import partsData from '../data/partsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')

describe('gameFps', () => {
  it('returns 0 without a cpu or gpu', () => {
    expect(gameFps(null, gpu, '1440p', { fpsFactor: 2 })).toBe(0)
    expect(gameFps(cpu, null, '1440p', { fpsFactor: 2 })).toBe(0)
  })

  it('scales the baseline estimate by the game fpsFactor', () => {
    const base = estimateFps(cpu, gpu, '1440p')
    expect(gameFps(cpu, gpu, '1440p', { fpsFactor: 2 })).toBe(Math.round(base * 2))
  })

  it('gives a higher-fpsFactor game more FPS than a lower one', () => {
    expect(gameFps(cpu, gpu, '1440p', { fpsFactor: 2.6 }))
      .toBeGreaterThan(gameFps(cpu, gpu, '1440p', { fpsFactor: 0.5 }))
  })

  it('lower quality presets raise FPS, in order', () => {
    const game = { fpsFactor: 1, cpuFactor: 5 } // GPU-bound so quality matters
    const high = gameFps(cpu, gpu, '4k', game, 'high')
    const medium = gameFps(cpu, gpu, '4k', game, 'medium')
    const low = gameFps(cpu, gpu, '4k', game, 'low')
    expect(medium).toBeGreaterThan(high)
    expect(low).toBeGreaterThan(medium)
  })

  it('every quality step improves FPS, even for CPU-bound games', () => {
    const gpuBound = { fpsFactor: 1, cpuFactor: 5 }
    const cpuBound = { fpsFactor: 3, cpuFactor: 0.5 }
    for (const game of [gpuBound, cpuBound]) {
      const high = gameFps(cpu, gpu, '1440p', game, 'high')
      const medium = gameFps(cpu, gpu, '1440p', game, 'medium')
      const low = gameFps(cpu, gpu, '1440p', game, 'low')
      expect(medium).toBeGreaterThan(high)
      expect(low).toBeGreaterThan(medium)
    }
  })

  it('CPU-bound games gain far less from Low than GPU-bound ones', () => {
    const gpuBound = { fpsFactor: 1, cpuFactor: 5 }
    const cpuBound = { fpsFactor: 3, cpuFactor: 0.5 }
    const gain = (game) =>
      gameFps(cpu, gpu, '1080p', game, 'low') / gameFps(cpu, gpu, '1080p', game, 'high')
    expect(gain(cpuBound)).toBeCloseTo(1.15, 1) // settings buy a little CPU headroom
    expect(gain(gpuBound)).toBeCloseTo(1.45, 1) // and a lot of GPU headroom
  })

  it('a separate cpuFactor models CPU-bound games', () => {
    // Same GPU scaling, weaker CPU ceiling → fewer FPS.
    const balanced = gameFps(cpu, gpu, '1080p', { fpsFactor: 1.1, cpuFactor: 1.1 })
    const cpuBound = gameFps(cpu, gpu, '1080p', { fpsFactor: 1.1, cpuFactor: 0.6 })
    expect(cpuBound).toBeLessThan(balanced)
  })

  it('respects engine frame caps', () => {
    expect(gameFps(cpu, gpu, '1080p', { fpsFactor: 3, cpuFactor: 3, fpsCap: 60 })).toBe(60)
  })

  it('exposes the quality levels for the UI', async () => {
    const { QUALITY_LEVELS } = await import('../lib/gameFps')
    expect(QUALITY_LEVELS).toEqual(['low', 'medium', 'high'])
  })
})
