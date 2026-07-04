import { orbitRadii } from '../lib/orbitGeometry'

describe('orbitRadii', () => {
  it('keeps chips clear of the side panel columns on narrow desktops', () => {
    const { rx } = orbitRadii(1280, 800)
    // Side panels occupy ~304px each side; chips extend ~120px past the ring point.
    expect(640 + rx + 120).toBeLessThanOrEqual(1280 - 304)
  })

  it('keeps the classic circular ring on large screens', () => {
    const { rx, ry } = orbitRadii(1920, 1080)
    expect(rx).toBeCloseTo(1080 * 0.4)
    expect(ry).toBeCloseTo(1080 * 0.4)
  })

  it('never collapses below a usable radius', () => {
    const { rx } = orbitRadii(900, 800)
    expect(rx).toBeGreaterThanOrEqual(200)
  })
})
