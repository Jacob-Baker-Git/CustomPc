import { describe, it, expect } from 'vitest'
import { gameFps, FPS_TARGETS } from '../lib/gameFps'
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

  it('exposes the standard FPS targets', () => {
    expect(FPS_TARGETS).toEqual([60, 120, 144])
  })
})
