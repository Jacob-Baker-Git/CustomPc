import { describe, it, expect } from 'vitest'
import { encodeBuild, decodeBuild } from '../lib/buildCodec'
import partsData from '../data/partsData.json'
import peripheralsData from '../data/peripheralsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4060ti')
const mon = peripheralsData.find((p) => p.id === 'mon-dell-s2721dgf')

describe('buildCodec', () => {
  it('round-trips budget, resolution, parts and peripherals', () => {
    const code = encodeBuild({
      budget: 1500,
      resolution: '4k',
      parts: { cpu, gpu },
      peripherals: { monitor: mon },
    })
    const out = decodeBuild(code)
    expect(out.budget).toBe(1500)
    expect(out.resolution).toBe('4k')
    expect(out.parts.cpu.id).toBe(cpu.id)
    expect(out.parts.gpu.id).toBe(gpu.id)
    expect(out.peripherals.monitor.id).toBe(mon.id)
  })

  it('drops ids that are not in the catalog', () => {
    const code = encodeBuild({
      budget: 1000,
      resolution: '1440p',
      parts: { cpu, gpu: { id: 'gpu-does-not-exist' } },
      peripherals: {},
    })
    const out = decodeBuild(code)
    expect(out.parts.cpu.id).toBe(cpu.id)
    expect(out.parts.gpu).toBeUndefined()
  })

  it('returns null for garbage input', () => {
    expect(decodeBuild('!!!not-valid!!!')).toBeNull()
  })
})
