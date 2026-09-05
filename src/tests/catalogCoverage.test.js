import { describe, it, expect } from 'vitest'
import { coverageFor, EXPECTED, RATCHETED_KEYS, missingRatchetSources, requiredFor } from '../../scripts/catalog-coverage-core.mjs'
import partsData from '../data/partsData.json'
import { evaluateSpecRules } from '../lib/specRules'

const gpu = (id, fields = {}, specs = {}) => ({ id, category: 'gpu', ...fields, specs })
const pcCase = (id, fields = {}, specs = {}) => ({ id, category: 'case', tdp: 0, ...fields, specs })
const src = (url = 'https://example.com/x') => ({ url, checkedOn: '2026-08-28' })

describe('catalogue coverage', () => {
  it('knows which fields a GPU is expected to carry', () => {
    expect(EXPECTED.gpu.required).toContain('length')
    expect(EXPECTED.gpu.required).toContain('slotsThick')
    // ⚠️ adapterFrom is OPTIONAL: most cards ship no adapter, and a missing one
    // is a fact about the card, not a gap in the research.
    expect(EXPECTED.gpu.optional).toContain('adapterFrom')
    expect(EXPECTED.gpu.required).not.toContain('adapterFrom')
  })

  it('counts a part with no sources as unverified', () => {
    const c = coverageFor('gpu', [gpu('a', { length: 300, tdp: 200 })], {})
    expect(c.total).toBe(1)
    expect(c.verified).toBe(0)
    expect(c.fields.length.present).toBe(1)
    expect(c.fields.length.sourced).toBe(0)
  })

  it('counts a fully sourced part as verified', () => {
    const part = gpu('a',
      { length: 300, tdp: 200 },
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = { a: Object.fromEntries(EXPECTED.gpu.required.map((k) => [k, src()])) }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  // The whole point of Task 1: a deliberately deleted field, recorded as
  // unverifiable, is DONE — not an outstanding gap.
  it('treats a field recorded as unverifiable as researched', () => {
    const part = gpu('a',
      { tdp: 200 },   // no length at all
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = {
      a: {
        ...Object.fromEntries(EXPECTED.gpu.required.filter((k) => k !== 'length').map((k) => [k, src()])),
        length: { checkedOn: '2026-08-28', result: 'unverifiable', note: 'page retired' },
      },
    }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  it('does not count a missing optional field against a part', () => {
    const part = gpu('a',
      { length: 300, tdp: 200 },
      { slotsThick: 3, pcieGen: 4, powerConnectors: { pcie8: 2 }, vram: 12, memType: 'GDDR6X' })
    const sources = { a: Object.fromEntries(EXPECTED.gpu.required.map((k) => [k, src()])) }
    expect(coverageFor('gpu', [part], sources).verified).toBe(1)
  })

  it('ignores parts of other categories', () => {
    const parts = [gpu('a', { length: 300, tdp: 200 }), { id: 'b', category: 'psu', specs: {} }]
    expect(coverageFor('gpu', parts, {}).total).toBe(1)
  })

  // ⚠️ Was 'paste' until 2026-09-05, when paste gained expectations. Every real
  // category is now in EXPECTED, so this uses a name that never will be.
  it('returns null for a category with no expectations', () => {
    expect(coverageFor('nonexistent', [], {})).toBeNull()
  })
})

describe('case expectations', () => {
  it('expects the five fields the compatibility engine actually reads', () => {
    expect(EXPECTED.case.required).toEqual([
      'maxGpuLength', 'maxCoolerHeight', 'supportedFormFactors', 'expansionSlots', 'radiatorSupport',
    ])
    expect(EXPECTED.case.optional).toEqual([])
  })

  it('counts a fully sourced case as verified', () => {
    const part = pcCase('c',
      { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] },
      { expansionSlots: 7, radiatorSupport: { top: [240] } })
    const sources = { c: Object.fromEntries(EXPECTED.case.required.map((k) => [k, src()])) }
    expect(coverageFor('case', [part], sources).verified).toBe(1)
  })
})

describe('the ratchet', () => {
  // ⚠️ THE TRAP THIS ENCODES: every case carries `tdp: 0`, meaning "draws
  // nothing". It is a sentinel, not a researched figure. The old global
  // ['length','tdp'] would have demanded a source for 59 such zeros.
  it('never demands a source for a case tdp', () => {
    const part = pcCase('c', { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] })
    const sources = {
      c: { maxGpuLength: src(), maxCoolerHeight: src(), supportedFormFactors: src() },
    }
    expect(missingRatchetSources([part], sources, new Set(['case']))).toEqual([])
  })

  it('reports a case field that carries no source', () => {
    const part = pcCase('c', { maxGpuLength: 400, maxCoolerHeight: 170, supportedFormFactors: ['ATX'] })
    expect(missingRatchetSources([part], {}, new Set(['case']))).toEqual([
      'c.maxGpuLength', 'c.maxCoolerHeight', 'c.supportedFormFactors',
    ])
  })

  it('still demands length and tdp for a gpu', () => {
    const g = { id: 'g', category: 'gpu', length: 300, tdp: 200, specs: {} }
    expect(missingRatchetSources([g], {}, new Set(['gpu']))).toEqual(['g.length', 'g.tdp'])
  })

  it('ignores a category that is not yet verified', () => {
    const part = pcCase('c', { maxGpuLength: 400 })
    expect(missingRatchetSources([part], {}, new Set(['gpu']))).toEqual([])
  })

  it('ignores a field the part does not carry', () => {
    const part = pcCase('c', { maxGpuLength: 400 })
    const sources = { c: { maxGpuLength: src() } }
    expect(missingRatchetSources([part], sources, new Set(['case']))).toEqual([])
  })

  it('keeps gpu on length and tdp only', () => {
    expect(RATCHETED_KEYS.gpu).toEqual(['length', 'tdp'])
  })
})

describe('psu expectations', () => {
  const psu = (id, fields = {}, specs = {}) => ({ id, category: 'psu', tdp: 0, ...fields, specs })

  it('expects the three fields the engine actually reads', () => {
    expect(EXPECTED.psu.required).toEqual(['wattage', 'rating', 'connectors'])
    expect(EXPECTED.psu.optional).toEqual([])
  })

  it('counts a fully sourced psu as verified', () => {
    const part = psu('p', { wattage: 850 }, { rating: '80+ Gold', connectors: { pcie8: 4, eps8: 2 } })
    const sources = { p: Object.fromEntries(EXPECTED.psu.required.map((k) => [k, src()])) }
    expect(coverageFor('psu', [part], sources).verified).toBe(1)
  })

  // ⚠️ SAME TRAP AS THE CASE WORK: a PSU carries tdp: 0 because it draws
  // nothing itself. Ratcheting tdp would demand provenance for 53 sentinels.
  it('never demands a source for a psu tdp', () => {
    const part = psu('p', { wattage: 850 })
    expect(missingRatchetSources([part], { p: { wattage: src() } }, new Set(['psu']))).toEqual([])
  })

  it('reports an unsourced psu wattage', () => {
    expect(missingRatchetSources([psu('p', { wattage: 850 })], {}, new Set(['psu']))).toEqual(['p.wattage'])
  })
})

describe('motherboard expectations', () => {
  const board = (id, fields = {}, specs = {}) =>
    ({ id, category: 'motherboard', tdp: 14, ...fields, specs })

  it('expects the eleven fields a researched board carries', () => {
    expect(EXPECTED.motherboard.required).toEqual([
      'socket', 'formFactor', 'ramType', 'chipset',
      'ramSlots', 'maxRamGb', 'maxRamSpeed', 'pcieGen',
      'epsConnectors', 'sataPorts', 'm2Slots',
    ])
    expect(EXPECTED.motherboard.optional).toEqual([])
  })

  it('counts a fully sourced board as verified', () => {
    const part = board('m',
      { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5' },
      { chipset: 'B650', ramSlots: 4, maxRamGb: 256, maxRamSpeed: 8000, pcieGen: 5,
        epsConnectors: 2, sataPorts: 4, m2Slots: [{ pcieGen: 5, sata: false }] })
    const sources = { m: Object.fromEntries(EXPECTED.motherboard.required.map((k) => [k, src()])) }
    expect(coverageFor('motherboard', [part], sources).verified).toBe(1)
  })

  // ⚠️ A DIFFERENT trap from the case and PSU zeros. A board's tdp is 12-15, a
  // real number feeding the build's draw total - but no maker publishes a
  // motherboard TDP, so it is the app's own estimate and must not be given
  // provenance it does not have.
  it('never demands a source for a board tdp', () => {
    const part = board('m', { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5' })
    const sources = { m: { socket: src(), formFactor: src(), ramType: src() } }
    expect(missingRatchetSources([part], sources, new Set(['motherboard']))).toEqual([])
  })

  // `chipset` is re-verified (EXPECTED lists it) but nothing blocks on it, so no
  // future board owes it provenance.
  it('ratchets the three fields compatibility.js blocks on, and no others', () => {
    expect(RATCHETED_KEYS.motherboard).toEqual(['socket', 'formFactor', 'ramType'])
  })

  it('reports a board field that carries no source', () => {
    const part = board('m', { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5' })
    expect(missingRatchetSources([part], {}, new Set(['motherboard']))).toEqual([
      'm.socket', 'm.formFactor', 'm.ramType',
    ])
  })
})

describe('cooler expectations', () => {
  const cooler = (id, type, specs = {}, fields = {}) =>
    ({ id, category: 'cooler', tdp: 3, sockets: ['AM5'], ...fields, specs: { type, ...specs } })

  it('asks an air cooler for its height and an AIO for its radiator size', () => {
    expect(requiredFor(EXPECTED.cooler, cooler('a', 'Air', { height: 165 })))
      .toEqual(['sockets', 'type', 'height'])
    expect(requiredFor(EXPECTED.cooler, cooler('b', 'AIO', { radiatorMm: 360 })))
      .toEqual(['sockets', 'type', 'radiatorMm'])
  })

  it('counts a fully sourced air cooler and a fully sourced AIO as verified', () => {
    const parts = [cooler('a', 'Air', { height: 165 }), cooler('b', 'AIO', { radiatorMm: 360 })]
    const sources = {
      a: { sockets: src(), type: src(), height: src() },
      b: { sockets: src(), type: src(), radiatorMm: src() },
    }
    expect(coverageFor('cooler', parts, sources).verified).toBe(2)
  })

  // 🛑 THE CASE A FLAT LIST WITH BOTH SIZE FIELDS `optional` WOULD HAVE PASSED.
  // A cooler carrying neither a height nor a radiator size has a gap, not a
  // fact, and must never count as researched however well its other fields are
  // sourced.
  it('refuses to verify an air cooler that carries no height', () => {
    const sources = { a: { sockets: src(), type: src(), height: src() } }
    expect(coverageFor('cooler', [cooler('a', 'Air')], sources).verified).toBe(0)
  })

  it('refuses to verify a cooler whose type matches no variant', () => {
    const odd = { id: 'a', category: 'cooler', sockets: ['AM5'], tdp: 3, specs: { height: 165 } }
    expect(requiredFor(EXPECTED.cooler, odd)).toBeNull()
    const sources = { a: { sockets: src(), type: src(), height: src() } }
    expect(coverageFor('cooler', [odd], sources).verified).toBe(0)
  })

  // Without this the report would read `height 31/53`, which looks like a gap
  // and is not one: 22 of those rows are AIOs that owe no height at all.
  it('counts a size field only against the parts that owe it', () => {
    const parts = [cooler('a', 'Air', { height: 165 }), cooler('b', 'AIO', { radiatorMm: 360 })]
    const c = coverageFor('cooler', parts, {})
    expect(c.total).toBe(2)
    expect(c.fields.height.applies).toBe(1)
    expect(c.fields.radiatorMm.applies).toBe(1)
  })

  it('leaves a flat category reporting against its full row count', () => {
    const c = coverageFor('gpu', [gpu('a', { length: 300, tdp: 200 })], {})
    expect(c.fields.length.applies).toBe(c.total)
  })
})

describe('the cooler ratchet', () => {
  const air = { id: 'a', category: 'cooler', sockets: ['AM5'], tdp: 3, specs: { type: 'Air', height: 165 } }

  it('demands a source for a cooler sockets list', () => {
    expect(missingRatchetSources([air], {}, new Set(['cooler']))).toEqual(['a.sockets'])
  })

  // ⚠️ THE TRAP THIS ENCODES: a cooler's `tdp` of 2-5 W is the app's own
  // estimate of fan and pump draw, not a published figure. It must never be
  // asked for provenance.
  it('never demands a source for a cooler tdp', () => {
    expect(missingRatchetSources([air], { a: { sockets: src() } }, new Set(['cooler']))).toEqual([])
    expect(RATCHETED_KEYS.cooler).toEqual(['sockets'])
  })
})

describe('storage expectations', () => {
  const drive = (id, storageType, specs = {}) =>
    ({ id, category: 'storage', storageType, capacityGb: 1000, tdp: 7, specs })

  it('asks an M.2 drive for m2Sata and a cabled drive for nothing extra', () => {
    expect(requiredFor(EXPECTED.storage, drive('a', 'NVMe SSD', { readMbps: 7000, m2Sata: false })))
      .toEqual(['storageType', 'capacityGb', 'readMbps', 'm2Sata'])
    expect(requiredFor(EXPECTED.storage, drive('b', 'HDD', { readMbps: 190 })))
      .toEqual(['storageType', 'capacityGb', 'readMbps'])
    expect(requiredFor(EXPECTED.storage, drive('c', 'SATA SSD', { readMbps: 560 })))
      .toEqual(['storageType', 'capacityGb', 'readMbps'])
  })

  it('counts a fully sourced drive of each kind as verified', () => {
    const parts = [
      drive('a', 'NVMe SSD', { readMbps: 7000, m2Sata: false }),
      drive('b', 'HDD', { readMbps: 190 }),
    ]
    const sources = {
      a: { storageType: src(), capacityGb: src(), readMbps: src(), m2Sata: src() },
      b: { storageType: src(), capacityGb: src(), readMbps: src() },
    }
    expect(coverageFor('storage', parts, sources).verified).toBe(2)
  })

  // 🛑 An absent m2Sata and a researched `false` are DIFFERENT claims. Every
  // mainstream NVMe drive is `false`, and that has to be recorded rather than
  // left out, or the research cannot be told apart from the gap.
  it('refuses to verify an M.2 drive whose m2Sata was never recorded', () => {
    const sources = { a: { storageType: src(), capacityGb: src(), readMbps: src(), m2Sata: src() } }
    expect(coverageFor('storage', [drive('a', 'NVMe SSD', { readMbps: 7000 })], sources).verified).toBe(0)
  })

  it('does not count m2Sata against a drive that has no M.2 interface', () => {
    const parts = [
      drive('a', 'NVMe SSD', { readMbps: 7000, m2Sata: false }),
      drive('b', 'HDD', { readMbps: 190 }),
    ]
    const c = coverageFor('storage', parts, {})
    expect(c.total).toBe(2)
    expect(c.fields.m2Sata.applies).toBe(1)
    expect(c.fields.readMbps.applies).toBe(2)
  })

  it('ratchets the two top-level fields and no others', () => {
    expect(RATCHETED_KEYS.storage).toEqual(['storageType', 'capacityGb'])
  })
})

// 🛑 Coverage and rule 3 each hold their OWN copy of "is this an M.2 drive",
// because scripts/ cannot import src/lib (vite-node is not a dependency). This
// test is the only thing keeping them honest. If it fails, the two definitions
// have drifted and coverage will certify a drive against a rule that classifies
// it differently — which is the exact shape of the partPages.js bug that told
// 37 NVMe drives' readers the drive connects by cable.
describe('the M.2 definition', () => {
  // A board with one NVMe-only M.2 slot and NO SATA ports: it satisfies an M.2
  // drive and must block a cabled one, so which branch rule 3 took is
  // observable from the outside.
  const board = {
    id: 'b', category: 'motherboard', name: 'Test board',
    specs: { m2Slots: [{ pcieGen: 4, sata: false }], sataPorts: 0 },
  }

  it('agrees with rule 3 for every drive in the catalogue', () => {
    const drives = partsData.filter((p) => p.category === 'storage')
    expect(drives.length).toBe(52)
    for (const drive of drives) {
      const coverageSaysM2 = requiredFor(EXPECTED.storage, drive).includes('m2Sata')
      const ruleBlocked = evaluateSpecRules({ motherboard: board }, drive).status === 'blocked'
      expect(coverageSaysM2, `${drive.id} (${drive.storageType})`).toBe(!ruleBlocked)
    }
  })
})

describe('ram expectations', () => {
  const kit = (id, over = {}) =>
    ({ id, category: 'ram', ramType: 'DDR5', speed: 6000, capacityGb: 32, specs: { sticks: 2 }, ...over })

  it('expects the four fields the rules read, flat for every kit', () => {
    expect(requiredFor(EXPECTED.ram, kit('a')))
      .toEqual(['ramType', 'speed', 'capacityGb', 'sticks'])
    // A DDR4 single-DIMM kit owes exactly the same four - RAM is not conditional.
    expect(requiredFor(EXPECTED.ram, kit('b', { ramType: 'DDR4', capacityGb: 8, specs: { sticks: 1 } })))
      .toEqual(['ramType', 'speed', 'capacityGb', 'sticks'])
  })

  it('counts a fully sourced kit as verified', () => {
    const parts = [kit('a')]
    const sources = { a: { ramType: src(), speed: src(), capacityGb: src(), sticks: src() } }
    expect(coverageFor('ram', parts, sources).verified).toBe(1)
  })

  it('does not verify a kit whose sticks was never sourced', () => {
    const parts = [kit('a')]
    const sources = { a: { ramType: src(), speed: src(), capacityGb: src() } }
    expect(coverageFor('ram', parts, sources).verified).toBe(0)
  })

  it('ratchets the two top-level block-driving fields and no others', () => {
    expect(RATCHETED_KEYS.ram).toEqual(['ramType', 'capacityGb'])
  })
})

describe('cpu expectations', () => {
  const chip = (id, over = {}) =>
    ({ id, category: 'cpu', socket: 'AM5', tdp: 65, perfScore: 70, specs: { cores: 6, boostClock: 5.1 }, ...over })

  it('expects the four fields, flat for every processor', () => {
    expect(requiredFor(EXPECTED.cpu, chip('a')))
      .toEqual(['socket', 'tdp', 'cores', 'boostClock'])
    // A legacy Intel chip owes exactly the same four.
    expect(requiredFor(EXPECTED.cpu, chip('b', { socket: 'LGA1200', tdp: 125, legacy: true, specs: { cores: 8, boostClock: 5.3 } })))
      .toEqual(['socket', 'tdp', 'cores', 'boostClock'])
  })

  it('counts a fully sourced processor as verified', () => {
    const parts = [chip('a')]
    const sources = { a: { socket: src(), tdp: src(), cores: src(), boostClock: src() } }
    expect(coverageFor('cpu', parts, sources).verified).toBe(1)
  })

  it('does not verify a processor whose boostClock was never sourced', () => {
    const parts = [chip('a')]
    const sources = { a: { socket: src(), tdp: src(), cores: src() } }
    expect(coverageFor('cpu', parts, sources).verified).toBe(0)
  })

  it('ratchets the two top-level block-driving fields and no others', () => {
    expect(RATCHETED_KEYS.cpu).toEqual(['socket', 'tdp'])
  })
})

describe('fans expectations', () => {
  const fan = (id, over = {}) =>
    ({ id, category: 'fans', tdp: 2, specs: { size: '120mm', count: 1, rgb: false }, ...over })

  it('expects the three displayed specs, flat for every fan', () => {
    expect(requiredFor(EXPECTED.fans, fan('a'))).toEqual(['size', 'count', 'rgb'])
  })

  it('counts a fully sourced fan as verified', () => {
    const sources = { a: { size: src(), count: src(), rgb: src() } }
    expect(coverageFor('fans', [fan('a')], sources).verified).toBe(1)
  })

  it('does not verify a fan whose rgb was never sourced', () => {
    const sources = { a: { size: src(), count: src() } }
    expect(coverageFor('fans', [fan('a')], sources).verified).toBe(0)
  })

  // 🛑 No rule reads a fan, so there is deliberately NO ratchet entry.
  it('has no ratchet keys - nothing blocks on a fan', () => {
    expect(RATCHETED_KEYS.fans).toBeUndefined()
  })
})

describe('paste expectations', () => {
  const paste = (id, over = {}) =>
    ({ id, category: 'paste', tdp: 0, specs: { amountG: 4 }, ...over })

  it('expects the one researched spec, amountG', () => {
    expect(requiredFor(EXPECTED.paste, paste('a'))).toEqual(['amountG'])
  })

  it('counts a fully sourced paste as verified', () => {
    expect(coverageFor('paste', [paste('a')], { a: { amountG: src() } }).verified).toBe(1)
  })

  // The one paste with no published fill weight is DONE when recorded absent.
  it('counts an amountG recorded unverifiable (field absent) as researched', () => {
    const parts = [{ id: 'a', category: 'paste', tdp: 0, specs: {} }]
    const sources = { a: { amountG: { checkedOn: '2026-09-05', result: 'unverifiable', note: 'no published fill weight' } } }
    expect(coverageFor('paste', parts, sources).verified).toBe(1)
  })

  it('has no ratchet keys - nothing blocks on a paste', () => {
    expect(RATCHETED_KEYS.paste).toBeUndefined()
  })
})
