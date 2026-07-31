import { BOARD, MOUNTS } from '../lib/mountPoints'

describe('mountPoints', () => {
  it('describes an ATX board: 244mm front-to-back, 305mm tall', () => {
    expect(BOARD.widthMm).toBe(244)
    expect(BOARD.heightMm).toBe(305)
  })

  // A card placed by its rear edge has no xMm — it derives its X from the
  // board's own rear edge, so it cannot fall off it by construction. Likewise a
  // card seated on a slot declares `slotYMm` rather than its own centre. The
  // seating itself is asserted against the rendered geometry in
  // assemblyGeometry.test.js.
  const heightOf = (m) => m.yMm ?? m.slotYMm

  it('keeps every mount point on the board', () => {
    for (const [name, m] of Object.entries(MOUNTS)) {
      if (m.xMm !== undefined) {
        expect(Math.abs(m.xMm), name).toBeLessThanOrEqual(BOARD.widthMm / 2)
      }
      expect(Math.abs(heightOf(m)), name).toBeLessThanOrEqual(BOARD.heightMm / 2)
    }
  })

  it('gives every mount a height, by centre or by slot', () => {
    for (const [name, m] of Object.entries(MOUNTS)) {
      expect(Number.isFinite(heightOf(m)), name).toBe(true)
    }
  })

  it('puts the CPU socket above the PCIe slot, as on a real board', () => {
    expect(MOUNTS.cpu.yMm).toBeGreaterThan(heightOf(MOUNTS.gpu))
  })

  it('mounts the cooler on the CPU socket itself', () => {
    expect(MOUNTS.cooler).toEqual(MOUNTS.cpu)
  })

  it('puts the DIMM slots toward the case front, clear of the socket', () => {
    expect(MOUNTS.ram.xMm).toBeGreaterThan(MOUNTS.cpu.xMm)
  })

  it('spaces DIMM slots so two sticks cannot overlap', () => {
    expect(MOUNTS.ram.pitchMm).toBeGreaterThanOrEqual(7)
  })
})
