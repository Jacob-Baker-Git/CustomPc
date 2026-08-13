import { describe, it, expect } from 'vitest'
import { atDeclaredCap, peerRatioOutliers, residualOutlier, GPU_BOUND_SHORTFALL_PCT } from '../lib/perfEngine/gpuBound'

describe('atDeclaredCap', () => {
  it('rejects a row sitting at a game’s declared engine cap', () => {
    // elden-ring declares fpsCap 60 in perfGames.json. A row reading 60 there
    // measured the cap, not the card.
    expect(atDeclaredCap({ avgFps: 60 }, { fpsCap: 60 })).toBe(true)
    expect(atDeclaredCap({ avgFps: 59.4 }, { fpsCap: 60 })).toBe(true)
  })

  it('keeps a row comfortably under the cap', () => {
    expect(atDeclaredCap({ avgFps: 48 }, { fpsCap: 60 })).toBe(false)
  })

  it('keeps every row for a game with no declared cap', () => {
    expect(atDeclaredCap({ avgFps: 300 }, { fpsCap: null })).toBe(false)
    expect(atDeclaredCap({ avgFps: 300 }, {})).toBe(false)
    expect(atDeclaredCap({ avgFps: 300 }, undefined)).toBe(false)
  })
})

describe('peerRatioOutliers', () => {
  const cell = [
    { gpuId: 'a', fps1080: 138, fps1440: 100 },
    { gpuId: 'b', fps1080: 137, fps1440: 100 },
    { gpuId: 'c', fps1080: 140, fps1440: 101 },
    { gpuId: 'd', fps1080: 100, fps1440: 100 },  // held down: ratio 1.00 vs ~1.38
  ]

  it('flags the card whose ratio falls short of its peers', () => {
    expect(peerRatioOutliers(cell)).toEqual(['d'])
  })

  it('flags nothing when every card scales alike', () => {
    expect(peerRatioOutliers([...cell.slice(0, 3), { gpuId: 'e', fps1080: 139, fps1440: 100 }])).toEqual([])
  })

  it('refuses to judge a cell too small to have peers', () => {
    // ⚠️ BOTH cases INCLUDE the outlier `d`, deliberately. A three-card cell of
    // a/b/c would return [] whether or not the MIN_PEERS guard exists — there is
    // nothing in it to flag — so it would pass against an implementation with no
    // guard at all. With `d` present, removing the guard makes both return ['d'].
    expect(peerRatioOutliers([cell[0], cell[1], cell[3]])).toEqual([])
    expect(peerRatioOutliers([cell[0], cell[3]])).toEqual([])
  })

  it('ignores a card missing one of its two measurements', () => {
    expect(peerRatioOutliers([...cell, { gpuId: 'f', fps1080: 50 }])).toEqual(['d'])
  })

  it('exports the threshold it used, rather than burying it', () => {
    expect(GPU_BOUND_SHORTFALL_PCT).toBe(12)
  })

  it('measures shortfall against the median, not the mean, of its peers', () => {
    // Three peers at ratio 1.40 and one held-down card at 1.204 — a 14%
    // shortfall against the TRUE median (1.40), past the 12% threshold. An
    // average instead of a median is pulled toward the very outlier it is
    // supposed to judge: the mean here is 1.351, which reads as only a 10.9%
    // shortfall and would let the held-down card through. This is the same
    // failure mode MIN_PEERS guards against (an outlier hiding itself), but it
    // survives any peer count — it is the choice of statistic, not the size of
    // the group.
    const skewed = [
      { gpuId: 'p1', fps1080: 140, fps1440: 100 },
      { gpuId: 'p2', fps1080: 140, fps1440: 100 },
      { gpuId: 'p3', fps1080: 140, fps1440: 100 },
      { gpuId: 'low', fps1080: 120.4, fps1440: 100 },
    ]
    expect(peerRatioOutliers(skewed)).toEqual(['low'])
  })
})

describe('residualOutlier', () => {
  // The peer test needs the same card at BOTH resolutions, which holds for only
  // 176 of the 1058 1080p rows. This covers the rest: a row delivering far less
  // than the fitted GPU term predicts was held back by something.
  it('rejects a row far below what the GPU term predicts', () => {
    expect(residualOutlier(80, 100)).toBe(true)
  })

  it('keeps a row within tolerance either way', () => {
    expect(residualOutlier(95, 100)).toBe(false)
    expect(residualOutlier(100, 100)).toBe(false)
  })

  it('keeps a row ABOVE prediction, however far above', () => {
    // Only a shortfall indicates a limiter. An overshoot is noise, a favourable
    // test bench, or a fit still settling — never evidence the GPU was capped.
    expect(residualOutlier(140, 100)).toBe(false)
  })

  it('declines to judge without a usable prediction', () => {
    expect(residualOutlier(80, 0)).toBe(false)
    expect(residualOutlier(80, null)).toBe(false)
    expect(residualOutlier(0, 100)).toBe(false)
  })

  it('uses the SAME shortfall threshold as the peer rule', () => {
    // Two rules, one claim: "the GPU did not set this rate". Different
    // thresholds would mean a row's fate depended on whether it happened to
    // have a 1440p partner.
    expect(residualOutlier(100 * (1 - GPU_BOUND_SHORTFALL_PCT / 100) - 0.1, 100)).toBe(true)
    expect(residualOutlier(100 * (1 - GPU_BOUND_SHORTFALL_PCT / 100) + 0.1, 100)).toBe(false)
  })
})
