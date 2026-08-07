import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import partsData from '../data/partsData.json'
import gamesData from '../data/gamesData.json'
import { estimateFps } from '../lib/fpsEstimate'
import { gameFps } from '../lib/gameFps'
import { computeBottleneck } from '../lib/bottleneck'

const part = (id) => partsData.find((p) => p.id === id)
const game = (id) => gamesData.find((g) => g.id === id)

// Characterisation test. These are not "correct" answers — they are TODAY'S
// answers, recorded before the performance engine existed.
//
// The engine is deliberately built ALONGSIDE these three modules rather than on
// top of them, because they feed partSynergy -> partRatings -> the CustomPC
// score, and every auto-build recommendation. If engine work ever leaks into
// this path, every rating in the app moves silently and nothing else would
// catch it. A diff here means the blast radius grew: stop and go and find out
// why before updating a single number below.
describe('the legacy FPS path is untouched by the performance engine', () => {
  it('estimateFps returns its frozen values', () => {
    const cases = [
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '1080p', 140],
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '1440p', 105],
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '4k', 67],
      ['cpu-i5-13400f', 'gpu-rtx-4090', '1080p', 154],
      ['cpu-ryzen-7-9800x3d', 'gpu-rtx-4060', '1440p', 60],
    ]
    for (const [cpuId, gpuId, res, expected] of cases) {
      expect(estimateFps(part(cpuId), part(gpuId), res)).toBe(expected)
    }
  })

  it('gameFps returns its frozen values', () => {
    const cpu = part('cpu-ryzen-5-7600x')
    const gpu = part('gpu-rtx-5070')
    const cases = [
      ['cs2', 273],
      ['cyberpunk', 53],
      ['fortnite', 168],
      ['tarkov', 100],
      ['elden-ring', 60],
    ]
    for (const [gameId, expected] of cases) {
      expect(gameFps(cpu, gpu, '1440p', game(gameId), 'high')).toBe(expected)
    }
  })

  it('computeBottleneck returns its frozen values', () => {
    const cases = [
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '1080p',
       { balancePct: 92, limitedBy: 'none', cpuFps: 168, gpuFps: 140 }],
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '1440p',
       { balancePct: 84, limitedBy: 'none', cpuFps: 154, gpuFps: 105 }],
      ['cpu-ryzen-5-7600x', 'gpu-rtx-5070', '4k',
       { balancePct: 74, limitedBy: 'gpu', cpuFps: 140, gpuFps: 67 }],
      ['cpu-i5-13400f', 'gpu-rtx-4090', '1080p',
       { balancePct: 77, limitedBy: 'cpu', cpuFps: 154, gpuFps: 200 }],
      ['cpu-ryzen-7-9800x3d', 'gpu-rtx-4060', '1440p',
       { balancePct: 64, limitedBy: 'gpu', cpuFps: 220, gpuFps: 60 }],
    ]
    for (const [cpuId, gpuId, res, expected] of cases) {
      const got = computeBottleneck(part(cpuId), part(gpuId), res)
      expect({
        balancePct: got.balancePct, limitedBy: got.limitedBy,
        cpuFps: got.cpuFps, gpuFps: got.gpuFps,
      }).toEqual(expected)
    }
  })

  it('the legacy modules import nothing from the performance engine', () => {
    for (const file of ['fpsEstimate.js', 'gameFps.js', 'bottleneck.js', 'partSynergy.js']) {
      // NOTE: not `new URL(relative, import.meta.url)` — jsdom's global URL
      // polyfill mishandles file: bases with a Windows drive letter and
      // silently resolves to http://localhost:3000/..., which then 404s as
      // an ENOENT from readFileSync. Resolving against cwd (vitest runs from
      // the repo root) sidesteps that jsdom shadowing entirely.
      const src = readFileSync(resolve(process.cwd(), 'src/lib', file), 'utf8')
      expect(src).not.toMatch(/perfEngine|perfModel/)
    }
  })
})
