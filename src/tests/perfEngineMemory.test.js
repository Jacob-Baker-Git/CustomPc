import { describe, it, expect } from 'vitest'
import { memoryProfile, ramBaseline, ramEffectiveCap } from '../lib/perfEngine/memory'
import partsData from '../data/partsData.json'

const part = (id) => partsData.find((p) => p.id === id)

describe('memory baselines', () => {
  it('depends on the memory TYPE, not just the socket', () => {
    // LGA1700 takes both DDR4 and DDR5. Keying on socket alone judged a
    // perfectly good DDR4-3600 kit against the DDR5 figure and called it slow,
    // which would push someone to buy memory their board cannot take.
    expect(ramBaseline('LGA1700', 'DDR5')).toBe(5600)
    expect(ramBaseline('LGA1700', 'DDR4')).toBe(3200)
    expect(ramBaseline('LGA1700', 'DDR5')).toBeGreaterThan(ramBaseline('LGA1700', 'DDR4'))
  })

  it('returns null for a combination it does not know, rather than guessing', () => {
    expect(ramBaseline('LGA1200', 'DDR5')).toBeNull()   // that board does not exist
    expect(ramBaseline(undefined, 'DDR5')).toBeNull()
    expect(ramEffectiveCap('AM5', undefined)).toBeNull()
  })
})

describe('memoryProfile', () => {
  it('does not call a good DDR4 kit slow on a DDR4 board', () => {
    const cpu = part('cpu-i7-14700')                    // LGA1700
    const ram = partsData.find(
      (p) => p.category === 'ram' && p.ramType === 'DDR4' && p.speed >= 3200,
    )
    const profile = memoryProfile({ cpu, ram })
    expect(profile.baseline).toBe(3200)
    expect(profile.notes.some((n) => /below the/.test(n.text))).toBe(false)
  })

  it('does flag a genuinely slow kit for its own type', () => {
    const cpu = part('cpu-i7-14700')
    const profile = memoryProfile({ cpu, ram: { ramType: 'DDR4', speed: 2400, capacityGb: 16, specs: { sticks: 2 } } })
    expect(profile.notes.some((n) => /below the/.test(n.text))).toBe(true)
  })

  it('flags a single stick as single-channel', () => {
    const cpu = part('cpu-ryzen-5-7600x')
    const profile = memoryProfile({ cpu, ram: { ramType: 'DDR5', speed: 6000, capacityGb: 16, specs: { sticks: 1 } } })
    expect(profile.channels).toBe('single')
    expect(profile.notes.some((n) => n.severity === 'bad')).toBe(true)
  })

  it('notes when speed is past the point the controller stops gaining', () => {
    const cpu = part('cpu-ryzen-5-7600x')               // AM5, caps at 6400
    const profile = memoryProfile({ cpu, ram: { ramType: 'DDR5', speed: 8000, capacityGb: 32, specs: { sticks: 2 } } })
    expect(profile.effectiveSpeed).toBe(6400)
    expect(profile.notes.some((n) => /decouples/.test(n.text))).toBe(true)
  })

  it('returns null with no memory selected', () => {
    expect(memoryProfile({ cpu: part('cpu-ryzen-5-7600x') })).toBeNull()
  })

  it('says nothing at all about a kit whose platform it does not recognise', () => {
    // Missing metadata must never produce a complaint — an unknown socket is
    // not evidence of a slow kit.
    const profile = memoryProfile({ cpu: { socket: 'SOCKET-9000' }, ram: { ramType: 'DDR5', speed: 4800, capacityGb: 32, specs: { sticks: 2 } } })
    expect(profile.baseline).toBeNull()
    expect(profile.notes).toEqual([])
  })
})
