import { suggestUpgrade } from '../lib/upgradeAdvisor'

const catalog = [
  { id: 'cpu-am5-mid',  category: 'cpu', socket: 'AM5', price: 200, perfScore: 70 },
  { id: 'cpu-am5-top',  category: 'cpu', socket: 'AM5', price: 400, perfScore: 95 },
  { id: 'cpu-intel',    category: 'cpu', socket: 'LGA1700', price: 250, perfScore: 99 },
  { id: 'gpu-mid',      category: 'gpu', price: 400, perfScore: 60, length: 300 },
  { id: 'gpu-top',      category: 'gpu', price: 700, perfScore: 90, length: 320 },
  { id: 'gpu-huge',     category: 'gpu', price: 900, perfScore: 100, length: 400 },
]

const mb = { id: 'mb', category: 'motherboard', socket: 'AM5', ramType: 'DDR5', formFactor: 'ATX' }
const caseSmall = { id: 'case', category: 'case', maxGpuLength: 330, supportedFormFactors: ['ATX'] }

function build(extra = {}) {
  return {
    motherboard: mb,
    case: caseSmall,
    cpu: catalog.find((p) => p.id === 'cpu-am5-mid'),
    gpu: catalog.find((p) => p.id === 'gpu-mid'),
    ...extra,
  }
}

describe('suggestUpgrade', () => {
  it('returns null without a CPU and GPU', () => {
    expect(suggestUpgrade({ cpu: catalog[0] }, 2000, catalog)).toBeNull()
  })

  it('suggests an affordable, compatible, higher-FPS swap', () => {
    const s = suggestUpgrade(build(), 2000, catalog, '1440p')
    expect(s).not.toBeNull()
    expect(s.toPart.perfScore).toBeGreaterThan(s.fromPart.perfScore)
    expect(s.fpsGain).toBeGreaterThan(0)
  })

  it('never suggests an incompatible CPU (wrong socket)', () => {
    const parts = build({ cpu: catalog.find((p) => p.id === 'cpu-am5-top') })
    const s = suggestUpgrade(parts, 2000, catalog, '1440p')
    if (s) expect(s.category).not.toBe('cpu')
  })

  it('never suggests a GPU longer than the case clearance', () => {
    const s = suggestUpgrade(build(), 5000, catalog, '1440p')
    if (s && s.category === 'gpu') expect(s.toPart.length).toBeLessThanOrEqual(caseSmall.maxGpuLength)
  })

  it('returns null when nothing is affordable', () => {
    expect(suggestUpgrade(build(), 610, catalog, '1440p')).toBeNull()
  })
})
