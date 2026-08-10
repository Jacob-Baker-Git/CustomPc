import {
  PART_PAGE_CATEGORIES, hasPartPage, partPath, partIdFromPath, partById,
  partPageMeta, compatibilityNotes, pairings, pagedParts,
} from '../lib/partPages'
import parts from '../data/partsData.json'

const byCategory = (c) => parts.filter((p) => p.category === c)
const one = (c) => byCategory(c)[0]

describe('which parts get a page', () => {
  it('covers every category that can carry real content', () => {
    for (const c of ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler', 'fans']) {
      expect(PART_PAGE_CATEGORIES, c).toContain(c)
    }
  })

  // The whole risk with 500+ generated pages: a page with nothing on it but a
  // price reads as doorway content and drags the rest of the site with it.
  // Thermal paste carries no specs at all — id, name, brand, price and nothing
  // else — so there is no honest page to build. Better absent than thin.
  it('leaves out the one category with nothing to say', () => {
    expect(PART_PAGE_CATEGORIES).not.toContain('paste')
    expect(hasPartPage(one('paste'))).toBe(false)
  })

  it('gives a page to every other part in the catalogue', () => {
    const paged = pagedParts(parts)
    expect(paged.length).toBe(parts.length - byCategory('paste').length)
    expect(paged.every(hasPartPage)).toBe(true)
  })

  // Discontinued parts are exactly the long-tail searches — someone who owns a
  // GTX 1660 and wants to know what it is worth pairing with. They stay out of
  // recommendations, not out of the index.
  it('includes discontinued parts', () => {
    const legacy = parts.find((p) => p.legacy && p.category === 'gpu')
    expect(hasPartPage(legacy)).toBe(true)
  })
})

describe('part URLs', () => {
  it('is /parts/<id>', () => {
    expect(partPath({ id: 'gpu-rtx-4090', category: 'gpu' })).toBe('/parts/gpu-rtx-4090')
  })

  it('reads the id back out of a path', () => {
    expect(partIdFromPath('/parts/gpu-rtx-4090')).toBe('gpu-rtx-4090')
    expect(partIdFromPath('parts/gpu-rtx-4090')).toBe('gpu-rtx-4090')
    expect(partIdFromPath('/parts/gpu-rtx-4090/')).toBe('gpu-rtx-4090')
  })

  it('does not mistake the browser itself for a part', () => {
    expect(partIdFromPath('/parts')).toBeNull()
    expect(partIdFromPath('/parts/')).toBeNull()
  })

  it('refuses anything that is not a plain id, so a path cannot smuggle a segment', () => {
    expect(partIdFromPath('/parts/gpu-rtx-4090/extra')).toBeNull()
    expect(partIdFromPath('/parts/../../etc')).toBeNull()
    expect(partIdFromPath('/parts/Gpu Rtx')).toBeNull()
  })

  // Every id in the catalogue has to survive the round trip, or some part gets a
  // URL nothing can resolve.
  it('round-trips every part in the catalogue', () => {
    for (const part of pagedParts(parts)) {
      expect(partIdFromPath(partPath(part)), part.id).toBe(part.id)
    }
  })

  it('resolves an id back to its part, and nothing else', () => {
    expect(partById(parts, 'gpu-rtx-4090')?.id).toBe('gpu-rtx-4090')
    expect(partById(parts, 'nope')).toBeNull()
    // A paste id is a real catalogue id but has no page, so it must not resolve.
    expect(partById(parts, one('paste').id)).toBeNull()
  })
})

describe('per-part metadata', () => {
  it('titles the page after the part, not the site', () => {
    const meta = partPageMeta(parts.find((p) => p.id === 'gpu-rtx-4090'))
    expect(meta.title).toMatch(/RTX 4090/)
    // Six pages sharing one title was the hash-routing problem; 544 sharing one
    // would be worse.
    expect(meta.title).toMatch(/Custom PC Builder/)
  })

  it('writes a distinct title and description for every part', () => {
    const titles = new Set()
    const descriptions = new Set()
    for (const part of pagedParts(parts)) {
      const { title, description } = partPageMeta(part)
      titles.add(title)
      descriptions.add(description)
    }
    expect(titles.size).toBe(pagedParts(parts).length)
    expect(descriptions.size).toBe(pagedParts(parts).length)
  })

  it('keeps descriptions inside the length a search result shows', () => {
    for (const part of pagedParts(parts)) {
      const { description } = partPageMeta(part)
      expect(description.length, `${part.id}: ${description}`).toBeGreaterThan(50)
      expect(description.length, `${part.id}: ${description}`).toBeLessThanOrEqual(160)
    }
  })

  // The site's whole legal position on pricing. A generated page repeated 544
  // times is the last place to start calling an estimate a price.
  it('never calls a curated estimate a price', () => {
    const meta = partPageMeta(parts.find((p) => p.id === 'gpu-rtx-4090'))
    expect(meta.description).toMatch(/estimate/i)
  })
})

describe('what it works with', () => {
  const notesFor = (id) => compatibilityNotes(parts.find((p) => p.id === id), parts)

  it('says which boards take a processor, by its real socket', () => {
    const cpu = parts.find((p) => p.category === 'cpu' && p.socket === 'AM5')
    const text = compatibilityNotes(cpu, parts).map((n) => n.detail).join(' ')
    expect(text).toMatch(/AM5/)
    const boards = byCategory('motherboard').filter((b) => b.socket === 'AM5').length
    expect(text).toMatch(new RegExp(String(boards)))
  })

  it('says which cases a card actually fits, counted from the catalogue', () => {
    const gpu = parts.find((p) => p.id === 'gpu-rtx-4090')
    const fits = byCategory('case').filter((c) => c.maxGpuLength >= gpu.length).length
    const text = compatibilityNotes(gpu, parts).map((n) => n.detail).join(' ')
    expect(text).toMatch(new RegExp(String(fits)))
    expect(text).toMatch(new RegExp(String(gpu.length)))
  })

  it('gives every paged part at least one derived note', () => {
    for (const part of pagedParts(parts)) {
      const notes = compatibilityNotes(part, parts)
      expect(notes.length, `${part.id} has no notes`).toBeGreaterThan(0)
      for (const n of notes) {
        expect(n.label, part.id).toBeTruthy()
        expect(n.detail, part.id).toBeTruthy()
      }
    }
  })

  it('never claims a count it cannot support', () => {
    // A note must not name a number larger than the catalogue holds for that
    // category — the failure mode of a hand-written "works with 200+ boards".
    const boards = byCategory('motherboard').length
    for (const note of notesFor('cpu-ryzen-7-7700x')) {
      for (const n of note.detail.match(/\d+/g) ?? []) {
        if (/board/i.test(note.detail)) expect(Number(n)).toBeLessThanOrEqual(boards)
      }
    }
  })
})

describe('pairings', () => {
  it('suggests real catalogue parts, never the part itself', () => {
    const gpu = parts.find((p) => p.id === 'gpu-rtx-4090')
    const suggested = pairings(gpu, parts)
    expect(suggested.length).toBeGreaterThan(0)
    for (const { part } of suggested) {
      expect(parts).toContain(part)
      expect(part.id).not.toBe(gpu.id)
    }
  })

  // Same rule as the rest of the app: a discontinued part is selectable by hand
  // but never recommended. A generated page recommending a six-year-old card is
  // the misleading-price problem the terms page disclaims.
  it('never recommends a discontinued part', () => {
    for (const part of pagedParts(parts)) {
      for (const { part: suggestion } of pairings(part, parts)) {
        expect(suggestion.legacy, `${part.id} suggests ${suggestion.id}`).toBeFalsy()
      }
    }
  })

  it('pairs a processor with graphics and vice versa', () => {
    const cpuSuggestions = pairings(parts.find((p) => p.id === 'cpu-ryzen-7-7700x'), parts)
    expect(cpuSuggestions.some((s) => s.part.category === 'gpu')).toBe(true)
    const gpuSuggestions = pairings(parts.find((p) => p.id === 'gpu-rtx-4090'), parts)
    expect(gpuSuggestions.some((s) => s.part.category === 'cpu')).toBe(true)
  })

  it('pairs a board with something that actually fits its socket', () => {
    const board = parts.find((p) => p.category === 'motherboard' && p.socket === 'AM5')
    for (const { part } of pairings(board, parts)) {
      if (part.category === 'cpu') expect(part.socket).toBe('AM5')
      if (part.category === 'ram') expect(part.ramType).toBe(board.ramType)
    }
  })

  it('is deterministic, so a page does not reshuffle between visits', () => {
    const gpu = parts.find((p) => p.id === 'gpu-rtx-4090')
    expect(pairings(gpu, parts).map((s) => s.part.id)).toEqual(pairings(gpu, parts).map((s) => s.part.id))
  })
})
