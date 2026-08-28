import { describe, it, expect } from 'vitest'
import { diffTable, summarise } from '../../scripts/catalog-diff-core.mjs'

const p = (id, extra = {}) => ({ id, name: `Part ${id}`, price: 10, ...extra })

describe('catalog drift detection', () => {
  it('sees no drift when both sides hold the same rows', () => {
    const d = diffTable([p('a'), p('b')], [p('a'), p('b')])
    expect(d.missing).toEqual([])
    expect(d.extra).toEqual([])
    expect(d.changed).toEqual([])
  })

  // ⚠️ THE one that matters. Supabase returns `order=id`; partsData.json has its
  // own array order, and they disagree for all 544 linked parts. Comparing by
  // position would report the whole catalogue as drifted, every time, and the
  // check would be useless noise. Identity is the id, never the index.
  it('does not treat a different row order as drift', () => {
    const d = diffTable([p('a'), p('b'), p('c')], [p('c'), p('a'), p('b')])
    expect(summarise(d).drifted).toBe(false)
  })

  it('reports a row that is in the repo but not live', () => {
    const d = diffTable([p('a'), p('b')], [p('a')])
    expect(d.missing).toEqual(['b'])
  })

  it('reports a row that is live but no longer in the repo', () => {
    const d = diffTable([p('a')], [p('a'), p('zombie')])
    expect(d.extra).toEqual(['zombie'])
  })

  it('reports which fields differ on a changed row', () => {
    const d = diffTable([p('a', { length: 304 })], [p('a', { length: 336 })])
    expect(d.changed).toHaveLength(1)
    expect(d.changed[0].id).toBe('a')
    expect(d.changed[0].fields).toContain('length')
  })

  // Nested spec objects are the whole point of the research work, so a change
  // buried inside `specs` has to count.
  it('sees a change nested inside specs', () => {
    const d = diffTable([p('a', { specs: { slotsThick: 3 } })], [p('a', { specs: {} })])
    expect(d.changed[0].fields).toContain('specs')
  })

  // Key order in JSON is not meaning. Supabase round-trips objects through
  // jsonb, which does not preserve it.
  it('ignores key order within a row', () => {
    const d = diffTable([{ id: 'a', x: 1, y: 2 }], [{ id: 'a', y: 2, x: 1 }])
    expect(summarise(d).drifted).toBe(false)
  })

  it('summarises a clean comparison as not drifted', () => {
    expect(summarise(diffTable([p('a')], [p('a')])).drifted).toBe(false)
    expect(summarise(diffTable([p('a')], [])).drifted).toBe(true)
  })
})
