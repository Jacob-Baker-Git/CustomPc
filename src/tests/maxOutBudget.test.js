import { maxOutBudget } from '../lib/maxOutBudget'
import { targetBuild } from '../lib/targetBuilder'
import { estimateFps } from '../lib/fpsEstimate'
import partsData from '../data/partsData.json'
import gamesData from '../data/gamesData.json'

const fortnite = gamesData.find((g) => g.id === 'fortnite')
const total = (parts) => Object.values(parts).reduce((s, p) => s + (p?.price ?? 0), 0)

describe('maxOutBudget', () => {
  it('spends leftover budget on FPS upgrades without exceeding the budget', () => {
    // A modest 60fps target leaves a big chunk of a £1600 budget unspent.
    const { parts } = targetBuild(1600, '1440p', 60, fortnite, partsData)
    const before = estimateFps(parts.cpu, parts.gpu, '1440p')

    const upgraded = maxOutBudget(parts, 1600, partsData, '1440p')

    expect(estimateFps(upgraded.cpu, upgraded.gpu, '1440p')).toBeGreaterThan(before)
    expect(total(upgraded)).toBeLessThanOrEqual(1600)
  })

  it('returns the build unchanged when nothing affordable improves FPS', () => {
    const { parts } = targetBuild(1600, '1440p', 60, fortnite, partsData)
    const upgraded = maxOutBudget(parts, total(parts), partsData, '1440p')
    expect(upgraded).toEqual(parts)
  })
})
