import { describe, it, expect } from 'vitest'
import { segmentsOf, pathLength, isOrthoOr45 } from '../lib/boardPlan'

describe('path inspection', () => {
  it('splits a path into absolute segments', () => {
    expect(segmentsOf('M10 20 H30 V40 L50 60')).toEqual([
      [10, 20, 30, 20],
      [30, 20, 30, 40],
      [30, 40, 50, 60],
    ])
  })

  it('measures total path length', () => {
    // 20 across, then 20 down: 40.
    expect(pathLength('M0 0 H20 V20')).toBeCloseTo(40, 6)
  })

  it('accepts axis-aligned and 45 degree segments, rejects anything else', () => {
    expect(isOrthoOr45([0, 0, 10, 0])).toBe(true)
    expect(isOrthoOr45([0, 0, 0, 10])).toBe(true)
    expect(isOrthoOr45([0, 0, 10, 10])).toBe(true)
    expect(isOrthoOr45([0, 0, 10, 4])).toBe(false)
  })
})
