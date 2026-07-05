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

  it('skips marginal upgrades below the minimum meaningful gain', () => {
    // +1 perfScore ≈ +1.5 fps at 1440p — not worth suggesting a swap for.
    const tinyStep = [
      ...catalog,
      { id: 'gpu-barely', category: 'gpu', price: 420, perfScore: 61, length: 300 },
    ]
    const parts = { ...build(), cpu: { ...build().cpu, perfScore: 99 } }
    const s = suggestUpgrade(parts, 850, tinyStep, '1440p') // only gpu-barely affordable
    expect(s).toBeNull()
  })

  it('prefers a near-equal cheaper upgrade over a marginally better halo part', () => {
    const priced = [
      { id: 'gpu-value', category: 'gpu', price: 460, perfScore: 88, length: 300 },
      { id: 'gpu-halo',  category: 'gpu', price: 900, perfScore: 90, length: 300 },
    ]
    // Strong CPU so the GPU side sets FPS: value gains 42 fps for £60,
    // halo gains 45 fps for £500 — near-equal gain, wildly different value.
    const parts = build({ cpu: { id: 'cpu-big', category: 'cpu', socket: 'AM5', price: 200, perfScore: 99 } })
    const s = suggestUpgrade(parts, 5000, [...catalog, ...priced], '1440p')
    expect(s.toPart.id).toBe('gpu-value')
  })

  it('treats a cheaper-and-faster swap as the best possible value', () => {
    const bargain = { id: 'gpu-bargain', category: 'gpu', price: 350, perfScore: 87, length: 300 }
    const parts = build({ cpu: { id: 'cpu-big', category: 'cpu', socket: 'AM5', price: 200, perfScore: 99 } })
    const s = suggestUpgrade(parts, 5000, [...catalog, bargain], '1440p')
    expect(s.toPart.id).toBe('gpu-bargain')
    expect(s.extraCost).toBeLessThan(0)
  })
})
