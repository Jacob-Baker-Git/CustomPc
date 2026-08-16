import { describe, it, expect } from 'vitest'
import { BLADES, RAKE_DEG, FIN_ROW_HEIGHT, CONTACT_HEIGHT, bladeStyle } from '../lib/ramBoxGeometry'

describe('ramBoxGeometry', () => {
  it('carries five blades in two opposed banks', () => {
    expect(BLADES).toHaveLength(5)
    expect(BLADES.filter((b) => b.rake === 'left')).toHaveLength(3)
    expect(BLADES.filter((b) => b.rake === 'right')).toHaveLength(2)
  })

  it('pins the tuned spans and heights', () => {
    expect(BLADES.map((b) => [b.left, b.width])).toEqual([
      [2, 16], [22, 10], [36, 21], [64, 18], [85, 15],
    ])
    expect(BLADES.filter((b) => b.rake === 'left').every((b) => b.height === 12)).toBe(true)
    expect(BLADES.filter((b) => b.rake === 'right').every((b) => b.height === 16)).toBe(true)
  })

  it('never lets a blade run past the part', () => {
    for (const b of BLADES) expect(b.left + b.width).toBeLessThanOrEqual(100)
  })

  it('leaves a gap between every pair of blades', () => {
    for (let i = 1; i < BLADES.length; i++) {
      expect(BLADES[i].left).toBeGreaterThan(BLADES[i - 1].left + BLADES[i - 1].width)
    }
  })

  it('skews the two banks in opposite directions', () => {
    expect(bladeStyle(BLADES[0]).transform).toBe(`skewX(${RAKE_DEG}deg)`)
    expect(bladeStyle(BLADES[4]).transform).toBe(`skewX(-${RAKE_DEG}deg)`)
  })

  it('expresses position as a percentage, not pixels', () => {
    expect(bladeStyle(BLADES[0]).left).toBe('2%')
    expect(bladeStyle(BLADES[0]).width).toBe('16%')
  })

  it('holds fins and contacts at a fixed height', () => {
    expect(FIN_ROW_HEIGHT).toBe(18)
    expect(CONTACT_HEIGHT).toBe(13)
  })
})
