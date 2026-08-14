import { describe, it, expect } from 'vitest'
import model from '../data/perfModel.json'

describe('the fitted artefact covers 1080p', () => {
  const cellsWithA = (res) => Object.values(model.gameConst)
    .flatMap((byRes) => Object.values(byRes[res] ?? {}))
    .filter((cell) => cell?.A > 0).length

  it('has GPU cell constants at 1080p', () => {
    // Zero here is the pre-existing bug: the most common gaming resolution
    // answered nothing at all for anybody.
    expect(cellsWithA('1080p')).toBeGreaterThan(80)
  })

  it('did not lose 1440p or 4K in the process', () => {
    expect(cellsWithA('1440p')).toBeGreaterThan(50)
    expect(cellsWithA('4k')).toBeGreaterThan(30)
  })

  it('reports how many rows the fit rejected', () => {
    expect(model.rejectedNotGpuBound).toBeGreaterThan(0)
  })

  it('rejects a trim, not a purge', () => {
    // Fitting 1080p at all is justified by the bad rows being rare. Both rules
    // together take about 5% of the GPU corpus; if that ever became a third of
    // it, the honest reading is that 1080p is unfittable here after all and the
    // blanket exclusion was right — not that the detector should be loosened.
    const total = model.rejectedNotGpuBound + model.rejectedByResidual
    expect(model.gpuRowsConsidered).toBeGreaterThan(1000)
    expect(total / model.gpuRowsConsidered).toBeLessThan(0.15)
    expect(total).toBeGreaterThan(0)
  })

  it('keeps the anchor card pinned to the declared gauge', () => {
    // The anchor is a gauge, not a measurement — every index and every cell
    // constant is expressed relative to it. Widening the fit to 1080p changed
    // which card is measured most (the 2060 Super overtook the 4070), and
    // deriving the anchor from that count would have rescaled all 121 cell
    // constants in a diff where no prediction had actually changed. Pinning it
    // is what lets compare-perf-model.mjs stay a meaningful gate.
    expect(model.anchors.gpu).toBe('gpu-rtx-4070')
    expect(model.gpuIndex[model.anchors.gpu]['1440p']).toBe(100)
  })
})
