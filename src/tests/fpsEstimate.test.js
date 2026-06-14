import { estimateFps } from '../lib/fpsEstimate'

const strong = { perfScore: 100 }
const mid    = { perfScore: 60 }
const weakCpu = { perfScore: 40 }

describe('estimateFps', () => {
  it('returns 0 when CPU or GPU is missing', () => {
    expect(estimateFps(null, strong, '1440p')).toBe(0)
    expect(estimateFps(strong, null, '1440p')).toBe(0)
  })

  it('lands a top pair in believable ranges per resolution', () => {
    expect(estimateFps(strong, strong, '1080p')).toBe(200)
    expect(estimateFps(strong, strong, '1440p')).toBe(150)
    expect(estimateFps(strong, strong, '4k')).toBe(95)
  })

  it('drops as resolution rises for a balanced pair', () => {
    const a = estimateFps(strong, strong, '1080p')
    const b = estimateFps(strong, strong, '1440p')
    const c = estimateFps(strong, strong, '4k')
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it('rises with GPU power at a fixed resolution', () => {
    expect(estimateFps(strong, strong, '1440p'))
      .toBeGreaterThan(estimateFps(strong, mid, '1440p'))
  })

  it('lets a weak CPU cap FPS at low resolution', () => {
    expect(estimateFps(weakCpu, strong, '1080p')).toBe(96)
  })

  it('normalizes resolution casing and unknown values', () => {
    expect(estimateFps(strong, strong, '4K')).toBe(95)
    expect(estimateFps(strong, strong, 'banana')).toBe(150)
  })
})
