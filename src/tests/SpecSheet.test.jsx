import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SpecSheet from '../components/SpecSheet'
import { insight } from '../lib/specSheetContent'
import partsData from '../data/partsData.json'
import peripheralsData from '../data/peripheralsData.json'

const gpu = partsData.find((p) => p.id === 'gpu-rtx-4090')
const monitor = peripheralsData.find((p) => p.id === 'mon-asus-pg27aqdm') // 240Hz

describe('SpecSheet insights', () => {
  it('every part and peripheral gets a non-empty insight', () => {
    for (const p of [...partsData, ...peripheralsData]) {
      expect(insight(p), p.id).toBeTruthy()
    }
  })

  it('GPU sheets show expected FPS per resolution', () => {
    render(<SpecSheet part={gpu} />)
    expect(screen.getByText(/fps @ 1080p/i)).toBeInTheDocument()
    expect(screen.getByText(/fps @ 1440p/i)).toBeInTheDocument()
    expect(screen.getByText(/fps @ 4K/i)).toBeInTheDocument()
    // 100 perfScore * 0.95 at 4K.
    expect(screen.getByText(/~95 fps @ 4K/i)).toBeInTheDocument()
  })

  it('monitor sheets relate refresh rate to needed FPS', () => {
    render(<SpecSheet part={monitor} />)
    expect(screen.getByText(/~240 fps/i)).toBeInTheDocument()
  })

  it('PSU insight derives a comfortable build draw with headroom', () => {
    const psu = partsData.find((p) => p.id === 'psu-corsair-rm850x')
    expect(insight(psu)).toMatch(/~595W/) // 850 * 0.7
  })

  it('cooler insight distinguishes AIO from air height limits', () => {
    const air = partsData.find((p) => p.id === 'cooler-noctua-d15')
    const aio = partsData.find((p) => p.id === 'cooler-arctic-lf3-360')
    expect(insight(air)).toMatch(/165mm/)
    expect(insight(aio)).toMatch(/radiator/i)
  })
})
