import { describe, it, expect } from 'vitest'
import partsData from '../data/partsData.json'

describe('partsData integrity', () => {
  it('gives every part a non-empty string brand', () => {
    const missing = partsData.filter(
      (p) => typeof p.brand !== 'string' || p.brand.trim() === ''
    )
    expect(missing.map((p) => p.id)).toEqual([])
  })

  it('has unique ids', () => {
    const ids = partsData.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes the current-gen anchor parts', () => {
    const ids = new Set(partsData.map((p) => p.id))
    for (const id of [
      'gpu-rtx-5090', 'gpu-rx-9070xt', 'gpu-intel-arc-b580',
      'cpu-ryzen-9-9950x3d', 'cpu-intel-ultra-9-285k',
    ]) {
      expect(ids.has(id), `missing ${id}`).toBe(true)
    }
    expect(
      partsData.some((p) => p.category === 'motherboard' && p.socket === 'LGA1851')
    ).toBe(true)
  })

  it('keeps required per-category fields on every part', () => {
    for (const p of partsData) {
      expect(typeof p.price, p.id).toBe('number')
      if (p.category === 'cpu') {
        expect(typeof p.socket, p.id).toBe('string')
        expect(typeof p.perfScore, p.id).toBe('number')
      }
      if (p.category === 'gpu') {
        expect(typeof p.length, p.id).toBe('number')
        expect(typeof p.perfScore, p.id).toBe('number')
      }
      if (p.category === 'motherboard') {
        expect(typeof p.socket, p.id).toBe('string')
        expect(typeof p.ramType, p.id).toBe('string')
      }
    }
  })

  it('every LGA1851 CPU has a socket-compatible motherboard and cooler', () => {
    const intelCpus = partsData.filter((p) => p.category === 'cpu' && p.socket === 'LGA1851')
    expect(intelCpus.length).toBeGreaterThan(0)
    const boards = partsData.filter((p) => p.category === 'motherboard')
    const coolers = partsData.filter((p) => p.category === 'cooler')
    for (const cpu of intelCpus) {
      expect(boards.some((mb) => mb.socket === cpu.socket), `no board for ${cpu.id}`).toBe(true)
      expect(coolers.some((c) => Array.isArray(c.sockets) && c.sockets.includes(cpu.socket)),
        `no cooler for ${cpu.id}`).toBe(true)
    }
  })
})
