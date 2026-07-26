import { WU_PER_MM, mm } from '../lib/pcScale'

describe('pcScale', () => {
  it('maps a 305mm ATX board to the established 2.5 world units', () => {
    expect(mm(305)).toBeCloseTo(2.5, 2)
  })

  it('maps a 450mm tower to roughly the existing case height of 3.7', () => {
    expect(mm(450)).toBeCloseTo(3.69, 2)
  })

  it('exposes the ratio directly', () => {
    expect(WU_PER_MM).toBeCloseTo(1 / 122, 6)
  })
})
