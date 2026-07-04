import { targetBuild } from '../lib/targetBuilder'
import { gameFps } from '../lib/gameFps'
import partsData from '../data/partsData.json'
import gamesData from '../data/gamesData.json'

const fortnite = gamesData.find((g) => g.id === 'fortnite')
const alanWake = gamesData.find((g) => g.id === 'alan-wake-2')

describe('targetBuild', () => {
  it('produces a complete build that hits the FPS target when budget allows', () => {
    const { parts, met, estFps } = targetBuild(1500, '1440p', 120, fortnite, partsData)
    expect(met).toBe(true)
    expect(estFps).toBeGreaterThanOrEqual(120)
    expect(gameFps(parts.cpu, parts.gpu, '1440p', fortnite)).toBeGreaterThanOrEqual(120)
    for (const cat of ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler']) {
      expect(parts[cat]).toBeDefined()
    }
  })

  it('does not blow a big budget on a modest target', () => {
    const { parts, met } = targetBuild(3000, '1080p', 60, fortnite, partsData)
    const total = Object.values(parts).reduce((s, p) => s + p.price, 0)
    expect(met).toBe(true)
    expect(total).toBeLessThan(3000 * 0.7)
  })

  it('reports an unreachable target and returns the closest build instead', () => {
    const { parts, met, estFps } = targetBuild(800, '4k', 240, alanWake, partsData)
    expect(met).toBe(false)
    expect(estFps).toBeLessThan(240)
    expect(parts.cpu).toBeDefined()
    expect(parts.gpu).toBeDefined()
  })

  it('respects compatibility in the surrounding build', () => {
    const { parts } = targetBuild(1500, '1440p', 120, fortnite, partsData)
    expect(parts.motherboard.socket).toBe(parts.cpu.socket)
    expect(parts.ram.ramType).toBe(parts.motherboard.ramType)
  })
})
