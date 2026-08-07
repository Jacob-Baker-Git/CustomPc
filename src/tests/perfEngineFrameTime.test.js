import { describe, it, expect } from 'vitest'
import {
  msToFps, fpsToMs, blendFrameTime, cpuShare, limitedBy, applyFpsCap,
} from '../lib/perfEngine/frameTime'

describe('frame time conversion', () => {
  it('round-trips fps through ms', () => {
    for (const fps of [30, 60, 144, 341]) {
      expect(msToFps(fpsToMs(fps))).toBeCloseTo(fps, 9)
    }
  })

  it('returns 0 fps for a non-positive frame time rather than Infinity', () => {
    expect(msToFps(0)).toBe(0)
    expect(msToFps(-1)).toBe(0)
  })
})

describe('blendFrameTime', () => {
  it('approaches max() as k grows', () => {
    expect(blendFrameTime(10, 6, 200)).toBeCloseTo(10, 4)
  })

  it('is straight addition at k = 1', () => {
    expect(blendFrameTime(10, 6, 1)).toBeCloseTo(16, 9)
  })

  it('sits above max() at parity by exactly 2^(1/k) - 1', () => {
    // This is the whole reason the engine does not use max(): real hardware
    // overlaps imperfectly, so measurements sit ABOVE the max near the
    // crossover — which is where most real builds live.
    for (const k of [4, 5.1, 8]) {
      expect(blendFrameTime(10, 10, k) / 10).toBeCloseTo(Math.pow(2, 1 / k), 9)
    }
    expect(blendFrameTime(10, 10, 5.1) / 10).toBeCloseTo(1.1456, 3)
  })

  it('converges on max() as the terms separate', () => {
    expect(blendFrameTime(20, 10, 5.1) / 20).toBeCloseTo(1.0057, 3)
  })

  it('is monotonic in each term', () => {
    expect(blendFrameTime(11, 6, 5.1)).toBeGreaterThan(blendFrameTime(10, 6, 5.1))
    expect(blendFrameTime(10, 7, 5.1)).toBeGreaterThan(blendFrameTime(10, 6, 5.1))
  })

  it('degrades to the other term when one is missing', () => {
    expect(blendFrameTime(0, 6, 5.1)).toBe(6)
    expect(blendFrameTime(10, 0, 5.1)).toBe(10)
  })
})

describe('cpuShare', () => {
  it('is 0.5 at parity', () => {
    expect(cpuShare(10, 10, 5.1)).toBeCloseTo(0.5, 9)
  })

  it('rises toward 1 as the CPU term dominates', () => {
    expect(cpuShare(5, 20, 5.1)).toBeGreaterThan(0.99)
    expect(cpuShare(20, 5, 5.1)).toBeLessThan(0.01)
  })

  it('stays within [0, 1]', () => {
    for (const [g, c] of [[1, 100], [100, 1], [7, 7], [0, 5], [5, 0]]) {
      const s = cpuShare(g, c, 5.1)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

describe('limitedBy', () => {
  it('names the limiter, with a balanced band in the middle', () => {
    expect(limitedBy(0.9)).toBe('cpu')
    expect(limitedBy(0.5)).toBe('balanced')
    expect(limitedBy(0.1)).toBe('gpu')
  })
})

describe('applyFpsCap', () => {
  it('an fps ceiling is a frame-time floor', () => {
    expect(applyFpsCap(4, 60)).toBeCloseTo(1000 / 60, 9)
  })

  it('leaves a frame time already below the cap alone', () => {
    expect(applyFpsCap(20, 60)).toBe(20)
  })

  it('is a no-op with no cap', () => {
    expect(applyFpsCap(4, null)).toBe(4)
    expect(applyFpsCap(4, 0)).toBe(4)
  })
})
