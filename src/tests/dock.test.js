import { describe, it, expect } from 'vitest'
import { dockTotalLabel, dockAction } from '../lib/dock'

describe('dockTotalLabel', () => {
  it('shows the build total', () => {
    expect(dockTotalLabel({ view: 'build', build: 1576, desk: 0 })).toBe('Build £1,576')
  })
  it('names the peripherals separately on the Peripherals tab', () => {
    expect(dockTotalLabel({ view: 'peripherals', build: 1576, desk: 120 })).toBe('Build £1,576 + peripherals £120')
  })
  it('leaves the desk out of Summary when nothing is chosen there', () => {
    expect(dockTotalLabel({ view: 'summary', build: 1576, desk: 0 })).toBe('Build £1,576')
  })
  it('names the desk on Summary once something is chosen', () => {
    expect(dockTotalLabel({ view: 'summary', build: 1576, desk: 120 })).toBe('Build £1,576 + peripherals £120')
  })
  it('rounds to whole pounds', () => {
    expect(dockTotalLabel({ view: 'build', build: 1575.97, desk: 0 })).toBe('Build £1,576')
  })
})

describe('dockAction', () => {
  it('walks the parts path tab by tab', () => {
    expect(dockAction({ view: 'build', path: 'parts' })).toEqual({ label: 'Next: Performance', to: 'performance' })
    expect(dockAction({ view: 'performance', path: 'parts' })).toEqual({ label: 'Next: Peripherals', to: 'peripherals' })
  })
  it('sends a game-target build from Build to Peripherals', () => {
    expect(dockAction({ view: 'build', path: 'game' })).toEqual({ label: 'Next: Peripherals', to: 'peripherals' })
  })
  it('has no next step on Summary', () => {
    expect(dockAction({ view: 'summary', path: 'parts' })).toBeNull()
  })
})
