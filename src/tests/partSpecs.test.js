import { PART_SPECS } from '../lib/partSpecs'

describe('partSpecs', () => {
  // Two of these are deliberately NOT the datasheet figure. Where the mesh has
  // to meet the board mesh — a card in its slot, a DIMM in its slot — the drawn
  // slot wins over the spec sheet, because the board is the thing you see it
  // against. Both are within a real part's range anyway.
  it('sizes every part against a real-world reference', () => {
    expect(PART_SPECS.motherboard.lengthMm).toBe(305) // ATX long edge
    expect(PART_SPECS.gpu.lengthMm).toBe(300)         // 3080 FE is 285; trimmed from 320 against the render
    expect(PART_SPECS.cooler.lengthMm).toBe(271)      // measured 240 AIO
    expect(PART_SPECS.ram.lengthMm).toBe(142)         // DIMM is 133; sized to fill the slot
    // Two parts are sized on all three axes rather than uniformly: the PSU
    // because its mesh is near-cubic where a real unit is not, and the M.2
    // because filling the slot's length uniformly over-widened it into the GPU,
    // so its real 22 mm width is pinned separately.
    expect(PART_SPECS.psu.sizeMm).toEqual([160, 80, 150]) // ATX is 86 tall; shortened on request
    expect(PART_SPECS.storage.sizeMm).toEqual([100, 22, 2]) // M.2 2280 is 80 long; filled to the drawn slot
  })

  it('gives every part exactly one sizing rule', () => {
    for (const [cat, spec] of Object.entries(PART_SPECS)) {
      const uniform = spec.lengthMm !== undefined
      expect(uniform !== (spec.sizeMm !== undefined), `${cat} needs lengthMm or sizeMm, not both`).toBe(true)
      if (spec.sizeMm) expect(spec.sizeMm, cat).toHaveLength(3)
      // fitAxis only means anything for a uniform fit.
      if (spec.sizeMm) expect(spec.fitAxis, cat).toBeUndefined()
    }
  })

  it('records the raw GLB bounding box for every part', () => {
    for (const [cat, spec] of Object.entries(PART_SPECS)) {
      expect(spec.raw, cat).toHaveLength(3)
      expect(Math.max(...spec.raw), cat).toBeGreaterThan(0)
    }
  })

  it('uses only right-angle rotations, so world boxes stay axis-aligned', () => {
    for (const [cat, spec] of Object.entries(PART_SPECS)) {
      for (const r of spec.rotation) {
        expect(Math.abs(r % (Math.PI / 2)), cat).toBeCloseTo(0, 6)
      }
    }
  })

  it('names a valid fit axis where one is given', () => {
    for (const [cat, spec] of Object.entries(PART_SPECS)) {
      if (spec.fitAxis !== undefined) expect([0, 1, 2], cat).toContain(spec.fitAxis)
    }
  })
})
