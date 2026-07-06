import { upgradeCandidates, sortCandidates } from '../lib/upgradeAdvisor'

// CPU-limited rig: only CPU upgrades move the min(cpu, gpu) FPS, so a GPU-only
// swap yields ~0 gain and must be dropped.
const cpuLo = { id: 'cpu-lo', category: 'cpu', name: 'CPU Lo', price: 100, perfScore: 50,  tdp: 65,  socket: 'AM5' }
const cpuHi = { id: 'cpu-hi', category: 'cpu', name: 'CPU Hi', price: 300, perfScore: 250, tdp: 105, socket: 'AM5' }
const gpuLo = { id: 'gpu-lo', category: 'gpu', name: 'GPU Lo', price: 200, perfScore: 300, tdp: 200, length: 250 }
const gpuHi = { id: 'gpu-hi', category: 'gpu', name: 'GPU Hi', price: 600, perfScore: 600, tdp: 320, length: 300 }
const catalog = [cpuLo, cpuHi, gpuLo, gpuHi]
const game = { id: 'g', name: 'G', fpsFactor: 1, cpuFactor: 1 }
const cur = { cpu: cpuLo, gpu: gpuLo }

describe('upgradeCandidates', () => {
  it('includes the bottleneck-side (CPU) upgrade, drops the no-gain GPU swap', () => {
    const r = upgradeCandidates(cur, { game, resolution: '1080p', targetFps: 1, budget: 1000 }, catalog)
    const ids = r.map((c) => c.toPart.id)
    expect(ids).toContain('cpu-hi')
    expect(ids).not.toContain('gpu-hi')
    r.forEach((c) => expect(c.fpsGain).toBeGreaterThan(0))
    const cpuUp = r.find((c) => c.toPart.id === 'cpu-hi')
    expect(cpuUp.extraCost).toBe(200)
    expect(typeof cpuUp.fixesBottleneck).toBe('boolean')
  })
  it('excludes candidates over the upgrade budget', () => {
    const r = upgradeCandidates(cur, { game, resolution: '1080p', targetFps: 1, budget: 150 }, catalog)
    expect(r.map((c) => c.toPart.id)).not.toContain('cpu-hi') // +200 over 150
  })
  it('flags meetsGoal against the target FPS', () => {
    const easy = upgradeCandidates(cur, { game, resolution: '1080p', targetFps: 1, budget: 1000 }, catalog)
    expect(easy.some((c) => c.meetsGoal)).toBe(true)
    const hard = upgradeCandidates(cur, { game, resolution: '1080p', targetFps: 100000, budget: 1000 }, catalog)
    expect(hard.every((c) => c.meetsGoal === false)).toBe(true)
  })
  it('returns [] without a CPU or GPU', () => {
    expect(upgradeCandidates({ cpu: cpuLo }, { game, resolution: '1080p', targetFps: 1, budget: 1000 }, catalog)).toEqual([])
  })
})

describe('sortCandidates', () => {
  const list = [
    { toPart: { id: 'a' }, fpsGain: 10, extraCost: 200, pricePerFps: 20 },
    { toPart: { id: 'b' }, fpsGain: 30, extraCost: 600, pricePerFps: 20 },
    { toPart: { id: 'c' }, fpsGain: 5,  extraCost: 0,   pricePerFps: 0 },
  ]
  it('value: lowest £/FPS first (free upgrade wins)', () => {
    expect(sortCandidates(list, 'value').map((c) => c.toPart.id)).toEqual(['c', 'a', 'b'])
  })
  it('gain: most FPS first', () => {
    expect(sortCandidates(list, 'gain').map((c) => c.toPart.id)).toEqual(['b', 'a', 'c'])
  })
  it('cost: cheapest first', () => {
    expect(sortCandidates(list, 'cost').map((c) => c.toPart.id)).toEqual(['c', 'a', 'b'])
  })
})
