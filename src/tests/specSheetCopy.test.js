import { describe, it, expect } from 'vitest'
import { insight, specRows } from '../lib/specSheetContent'
import { estimatePower } from '../lib/perfEngine/power'
import partsData from '../data/partsData.json'
import peripheralsData from '../data/peripheralsData.json'

const ofCat = (data, c) => data.filter((p) => p.category === c)

// DDR speed is a transfer rate, not a clock. DDR5-6000 runs a 3000 MHz clock
// and moves 6000 MT/s, so quoting "6000MHz" is out by a factor of two and names
// the wrong quantity. The site gets this right everywhere it prints a number —
// specRows says "Speed (MT/s)" and partStats appends " MT/s" — which made the
// prose underneath contradict the table directly above it on the same card.
describe('memory is described in transfer rates, not clocks', () => {
  const ddr5 = ofCat(partsData, 'ram').filter((p) => p.ramType === 'DDR5')

  it('has DDR5 kits to describe', () => {
    expect(ddr5.length).toBeGreaterThan(0)
  })

  it('never quotes a memory speed in MHz', () => {
    for (const kit of ddr5) {
      expect(insight(kit), kit.id).not.toMatch(/\d\s*MHz/i)
    }
  })

  it('quotes the sweet spot in MT/s', () => {
    expect(insight(ddr5[0])).toMatch(/MT\/s/)
  })
})

// "far beyond what anyone plays at" is true of a 26,000 DPI gaming sensor and
// false of the 800 DPI office mouse in the catalogue — which is roughly where
// people actually play. The claim was unconditional, so the cheapest mouse on
// the site told its buyer the opposite of the truth.
describe('mouse DPI copy matches the mouse', () => {
  const mice = ofCat(peripheralsData, 'mouse')
  const low = mice.filter((m) => m.dpi < 8000)

  it('has a low-DPI mouse to describe', () => {
    expect(low.length).toBeGreaterThan(0)
  })

  it('does not tell a low-DPI mouse it is beyond what anyone plays at', () => {
    for (const m of low) {
      expect(insight(m), `${m.name} (${m.dpi} DPI)`).not.toMatch(/far beyond/i)
    }
  })

  it('still says so for a genuinely high-DPI sensor', () => {
    const high = mice.find((m) => m.dpi >= 20000)
    expect(insight(high), high.name).toMatch(/far beyond/i)
  })
})

// Every switch type in the catalogue needs a description, or the info sheet
// falls through to restating the field it is meant to explain — "Membrane
// switches." tells a first-time buyer nothing, and membrane boards are the ones
// whose buyer is most likely to be new to this.
describe('every keyboard switch type is explained', () => {
  const keyboards = ofCat(peripheralsData, 'keyboard')

  it('has keyboards to describe', () => {
    expect(keyboards.length).toBeGreaterThan(0)
  })

  it('says something beyond the switch name for every type in the catalogue', () => {
    for (const k of keyboards) {
      const text = insight(k)
      expect(text, `${k.name} (${k.switch})`).not.toBe(`${k.switch} switches.`)
    }
  })
})

// The Performance tab renders this straight into "From the wall — at 80+ {tier}".
// The tier came back as the lowercase map key, so the page printed "at 80+ gold"
// next to a catalogue that writes "80+ Gold" everywhere else.
describe('the 80 PLUS tier reads the way the catalogue writes it', () => {
  const psuOf = (rating) => ({ category: 'psu', wattage: 850, tdp: 0, specs: { rating } })

  it('capitalises the tier it hands the UI', () => {
    const report = estimatePower({ cpu: { tdp: 105 }, gpu: { tdp: 320 }, psu: psuOf('80+ Gold') })
    expect(report.efficiencyTier).toBe('Gold')
  })

  it('still recognises every rating the catalogue actually uses', () => {
    const ratings = [...new Set(partsData.filter((p) => p.category === 'psu').map((p) => p.specs.rating))]
    expect(ratings.length).toBeGreaterThan(0)
    for (const r of ratings) {
      const report = estimatePower({ cpu: { tdp: 105 }, psu: psuOf(r) })
      expect(report.efficiencyTier, r).toBeTruthy()
      expect(r, `${r} should contain the tier it resolved to`).toMatch(new RegExp(report.efficiencyTier, 'i'))
    }
  })
})

// Currently unreachable — no part carries `specs.speedMhz` — but the label was
// wrong, and a dead label is one data migration away from being a live one.
describe('a memory-speed spec field is labelled as a transfer rate', () => {
  it('labels specs.speedMhz in MT/s', () => {
    const rows = specRows({ category: 'ram', name: 'synthetic', specs: { speedMhz: 6000 } })
    const label = rows.find(([, v]) => v === '6000')?.[0]
    expect(label).toBeTruthy()
    expect(label).not.toMatch(/MHz/i)
    expect(label).toMatch(/MT\/s/)
  })
})

// 🛑 specSheetContent.js:98 hardcoded the word "sticks", so a single-DIMM kit
// rendered "8GB across 1 sticks". partPages.js:145 prints the same field through
// count(n, 'stick') and pluralises correctly - two readers, one robust, one not,
// exactly the storage partPages cable bug. The two 8GB kits ship this today.
describe('a single-DIMM kit is not described as "1 sticks"', () => {
  const singles = ofCat(partsData, 'ram').filter((p) => p.specs?.sticks === 1)

  it('has a single-DIMM kit to describe', () => {
    expect(singles.length).toBeGreaterThan(0)
  })

  it('never renders "1 sticks"', () => {
    for (const kit of singles) {
      expect(insight(kit), kit.id).not.toMatch(/\b1 sticks\b/)
      expect(insight(kit), kit.id).toMatch(/\b1 stick\b/)
    }
  })
})

// amountG is added to paste in this project (the tube weight, the SKU
// differentiator). The sheet leads with it when present and falls back to the
// generic sentence when it is not, so a mid-research row still reads correctly.
describe('a paste spec sheet shows its tube size', () => {
  it('leads with the gram weight when amountG is present', () => {
    expect(insight({ id: 'p', category: 'paste', specs: { amountG: 4 } }))
      .toMatch(/^4g tube\. /)
  })

  it('falls back to the generic sentence when amountG is absent', () => {
    const generic = insight({ id: 'p', category: 'paste', specs: {} })
    expect(generic).toMatch(/^Sits between the CPU/)
    // a paste row with no specs object at all must not throw
    expect(insight({ id: 'q', category: 'paste' })).toBe(generic)
  })
})
