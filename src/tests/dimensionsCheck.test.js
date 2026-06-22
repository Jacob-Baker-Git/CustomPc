import { describe, it, expect } from 'vitest'
import { dimensionsCheck } from '../lib/dimensionsCheck'

describe('dimensionsCheck', () => {
  it('passes when the GPU fits the case', () => {
    const rows = dimensionsCheck({ gpu: { length: 300 }, case: { maxGpuLength: 360, maxCoolerHeight: 170 } })
    expect(rows.find((r) => r.id === 'gpu-length').status).toBe('pass')
  })
  it('fails when the GPU is longer than the case allows', () => {
    const rows = dimensionsCheck({ gpu: { length: 400 }, case: { maxGpuLength: 360, maxCoolerHeight: 170 } })
    expect(rows.find((r) => r.id === 'gpu-length').status).toBe('fail')
  })
  it('passes when the air cooler fits', () => {
    const rows = dimensionsCheck({ cooler: { specs: { height: 158 } }, case: { maxGpuLength: 360, maxCoolerHeight: 170 } })
    expect(rows.find((r) => r.id === 'cooler-height').status).toBe('pass')
  })
  it('fails when the cooler is too tall', () => {
    const rows = dimensionsCheck({ cooler: { specs: { height: 185 } }, case: { maxGpuLength: 360, maxCoolerHeight: 170 } })
    expect(rows.find((r) => r.id === 'cooler-height').status).toBe('fail')
  })
  it('marks checks NA when parts are missing', () => {
    const rows = dimensionsCheck({})
    expect(rows.every((r) => r.status === 'na')).toBe(true)
    expect(rows).toHaveLength(2)
  })
})
