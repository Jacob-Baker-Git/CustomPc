import { BOARD, MOUNTS } from '../lib/mountPoints'

describe('mountPoints', () => {
  it('describes an ATX board: 244mm front-to-back, 305mm tall', () => {
    expect(BOARD.widthMm).toBe(244)
    expect(BOARD.heightMm).toBe(305)
  })

  it('keeps every mount point on the board', () => {
    for (const [name, m] of Object.entries(MOUNTS)) {
      expect(Math.abs(m.xMm), name).toBeLessThanOrEqual(BOARD.widthMm / 2)
      expect(Math.abs(m.yMm), name).toBeLessThanOrEqual(BOARD.heightMm / 2)
    }
  })

  it('puts the CPU socket above the PCIe slot, as on a real board', () => {
    expect(MOUNTS.cpu.yMm).toBeGreaterThan(MOUNTS.gpu.yMm)
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
