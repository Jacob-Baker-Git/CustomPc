import { describe, it, expect } from 'vitest'
import { refreshFit, REFRESH_TIERS } from '../lib/refreshFit'

describe('refreshFit', () => {
  it('scales to the next common refresh rate above the average, with headroom', () => {
    expect(refreshFit(52, 40).scaleMax).toBe(60)
    expect(refreshFit(58, 40).scaleMax).toBe(120)
    expect(refreshFit(200, 150).scaleMax).toBe(240)
  })

  it('never runs off the top of the scale', () => {
    const f = refreshFit(900, 700)
    expect(f.scaleMax).toBe(REFRESH_TIERS.at(-1))
    expect(f.avgPct).toBe(100)
    expect(f.lowPct).toBe(100)
  })

  it('places the average and the lows as fractions of the scale', () => {
    const f = refreshFit(90, 60)
    expect(f.scaleMax).toBe(120)
    expect(f.avgPct).toBe(75)
    expect(f.lowPct).toBe(50)
    expect(f.ticks).toEqual([30, 60, 120])
  })

  it('says a build holds a refresh rate when even its lows clear it', () => {
    expect(refreshFit(75, 64).verdict).toBe('Keeps up with a 60 Hz screen, dips included.')
  })

  it('says where the average and the dips land when they differ', () => {
    expect(refreshFit(130, 70).verdict).toBe('Averages over 120 fps, but dips to 70; steady at 60 Hz.')
  })

  it('reads from the average alone when there are no lows', () => {
    const f = refreshFit(65, null)
    expect(f.lowPct).toBeNull()
    expect(f.verdict).toBe('Averages over 60 fps.')
  })

  // 30 is a playable floor, not a monitor: no screen runs at 30 Hz.
  it('treats 30 as a frame-rate floor rather than a screen', () => {
    expect(refreshFit(43, 32).verdict).toBe('Holds 30 fps, dips included, but falls short of a 60 Hz screen.')
    expect(refreshFit(70, 40).verdict).toBe('Averages over 60 fps, but dips to 40; steady at 30 fps.')
    expect(refreshFit(43, 32).tickLabels).toEqual(['30 fps', '60 Hz'])
  })

  it('calls a frame rate under 30 choppy and says what to do', () => {
    expect(refreshFit(22, 15).verdict).toBe('Under 30 fps: expect it to feel choppy. A lower setting or resolution will help.')
  })

  it('hedges a ceiling, which can only be lower', () => {
    expect(refreshFit(75, 64, { ceiling: true }).verdict).toBe('At best, keeps up with a 60 Hz screen, dips included.')
  })
})
