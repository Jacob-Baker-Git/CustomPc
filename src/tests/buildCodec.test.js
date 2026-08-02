import { describe, it, expect } from 'vitest'
import { encodeBuild, decodeBuild, MAX_SHARE_CODE_LENGTH } from '../lib/buildCodec'
import partsData from '../data/partsData.json'
import peripheralsData from '../data/peripheralsData.json'

const cpu = partsData.find((p) => p.id === 'cpu-ryzen-7-7700x')
const gpu = partsData.find((p) => p.id === 'gpu-rtx-4060ti')
const mon = peripheralsData.find((p) => p.id === 'mon-dell-s2721dgf')

describe('buildCodec', () => {
  it('round-trips budget, resolution, parts and peripherals', () => {
    const code = encodeBuild({
      budget: 1500,
      resolution: '4k',
      parts: { cpu, gpu },
      peripherals: { monitor: mon },
    })
    const out = decodeBuild(code)
    expect(out.budget).toBe(1500)
    expect(out.resolution).toBe('4k')
    expect(out.parts.cpu.id).toBe(cpu.id)
    expect(out.parts.gpu.id).toBe(gpu.id)
    expect(out.peripherals.monitor.id).toBe(mon.id)
  })

  it('drops ids that are not in the catalog', () => {
    const code = encodeBuild({
      budget: 1000,
      resolution: '1440p',
      parts: { cpu, gpu: { id: 'gpu-does-not-exist' } },
      peripherals: {},
    })
    const out = decodeBuild(code)
    expect(out.parts.cpu.id).toBe(cpu.id)
    expect(out.parts.gpu).toBeUndefined()
  })

  it('returns null for garbage input', () => {
    expect(decodeBuild('!!!not-valid!!!')).toBeNull()
  })

  // A share code arrives from a stranger's URL, so everything below is about
  // what a hand-crafted `?build=` can do to the person who clicks the link.
  describe('hostile input', () => {
    const codeFor = (payload) =>
      btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    it('refuses an oversized code instead of decoding it', () => {
      // Without a cap this is an atob + JSON.parse of megabytes on the main
      // thread — the click freezes the victim's tab.
      const huge = codeFor({ b: 0, r: '1440p', p: {}, x: {}, pad: 'A'.repeat(500_000) })
      expect(huge.length).toBeGreaterThan(MAX_SHARE_CODE_LENGTH)
      expect(decodeBuild(huge)).toBeNull()
    })

    it('accepts a code at the size limit', () => {
      const code = encodeBuild({ budget: 1500, resolution: '4k', parts: { cpu, gpu }, peripherals: { monitor: mon } })
      expect(code.length).toBeLessThanOrEqual(MAX_SHARE_CODE_LENGTH)
      expect(decodeBuild(code)).not.toBeNull()
    })

    it('falls back to 1440p for a resolution outside the allow-list', () => {
      // The only unvalidated field before: it reaches the FPS maths and the UI.
      expect(decodeBuild(codeFor({ b: 0, r: '<img onerror=1>', p: {}, x: {} })).resolution).toBe('1440p')
      expect(decodeBuild(codeFor({ b: 0, r: 'A'.repeat(200), p: {}, x: {} })).resolution).toBe('1440p')
      expect(decodeBuild(codeFor({ b: 0, r: 99, p: {}, x: {} })).resolution).toBe('1440p')
      expect(decodeBuild(codeFor({ b: 0, r: null, p: {}, x: {} })).resolution).toBe('1440p')
    })

    it('still accepts every resolution the app itself produces', () => {
      for (const r of ['1080p', '1440p', '4k']) {
        expect(decodeBuild(codeFor({ b: 0, r, p: {}, x: {} })).resolution).toBe(r)
      }
    })

    it('zeroes a budget that is negative or not a real number', () => {
      for (const b of [-5000, Infinity, NaN, 'lots', null]) {
        expect(decodeBuild(codeFor({ b, r: '1440p', p: {}, x: {} })).budget).toBe(0)
      }
    })

    it('clamps an absurdly large budget instead of rendering it', () => {
      // Finite but ridiculous: keep the intent, cap the value.
      expect(decodeBuild(codeFor({ b: 1e308, r: '1440p', p: {}, x: {} })).budget).toBe(1e7)
      expect(decodeBuild(codeFor({ b: 2500, r: '1440p', p: {}, x: {} })).budget).toBe(2500)
    })

    it('ignores category keys that are not real categories', () => {
      // JSON.parse creates __proto__ as a REAL own property (unlike an object
      // literal), so `parts[cat] = part` would reassign the prototype of the
      // parts object. Object.prototype itself is never touched, and this is not
      // XSS — but a share link could still swap a prototype and inject a bogus
      // "constructor" row into the parts list. Only real categories get through.
      const hostile = btoa(JSON.stringify({
        b: 0, r: '1440p',
        p: { __proto__: 'cpu-ryzen-7-7700x', constructor: 'cpu-ryzen-7-7700x', notacat: 'cpu-ryzen-7-7700x' },
        x: {},
      })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const out = decodeBuild(hostile)
      expect(Object.keys(out.parts)).toEqual([])
      expect(Object.getPrototypeOf(out.parts)).toBe(Object.prototype)
    })

    it('still accepts a genuine category', () => {
      const out = decodeBuild(encodeBuild({ budget: 0, resolution: '1440p', parts: { cpu }, peripherals: { monitor: mon } }))
      expect(out.parts.cpu.id).toBe(cpu.id)
      expect(out.peripherals.monitor.id).toBe(mon.id)
    })

    it('survives p/x being the wrong type', () => {
      const out = decodeBuild(codeFor({ b: 100, r: '1440p', p: 'not-an-object', x: 42 }))
      expect(out.parts).toEqual({})
      expect(out.peripherals).toEqual({})
    })
  })
})
