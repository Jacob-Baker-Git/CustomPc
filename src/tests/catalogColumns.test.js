import { describe, it, expect } from 'vitest'
import { upsertPayload, mirroredColumns } from '../../scripts/catalog-columns.mjs'

const part = (extra = {}) => ({ id: 'gpu-x', category: 'gpu', name: 'GPU X', price: 10, specs: { vram: 8 }, ...extra })

describe('upsert payload', () => {
  // The regression this file exists for: a payload of { id, data } left the
  // NOT NULL mirrored columns empty, and Postgres rejected the whole batch with
  // 23502 the first time the push was ever run for real.
  it('carries the columns the parts table requires, not just id and data', () => {
    const [row] = upsertPayload('parts', [part()])
    expect(row).toMatchObject({ id: 'gpu-x', category: 'gpu', name: 'GPU X', price: 10 })
  })

  it('sends the whole row as data, unchanged', () => {
    const p = part()
    const [row] = upsertPayload('parts', [p])
    expect(row.data).toEqual(p)
  })

  it('mirrors only name for games, which has no category or price column', () => {
    const [row] = upsertPayload('games', [{ id: 'lol', name: 'League of Legends', slug: 'league-of-legends' }])
    expect(row).toEqual({ id: 'lol', name: 'League of Legends', data: { id: 'lol', name: 'League of Legends', slug: 'league-of-legends' } })
  })

  it('mirrors category, name and price for peripherals', () => {
    const [row] = upsertPayload('peripherals', [{ id: 'mon-a', category: 'monitor', name: 'Monitor A', price: 200 }])
    expect(row).toMatchObject({ id: 'mon-a', category: 'monitor', name: 'Monitor A', price: 200 })
  })

  // Failing here names the row and the field. Failing at Postgres names a
  // column, after a round trip, having already abandoned the batch.
  it('refuses a row missing a required column, naming the row and the column', () => {
    expect(() => upsertPayload('parts', [part({ category: undefined })])).toThrow(/gpu-x.*category/)
  })

  it('treats an explicit null as missing, because the column is NOT NULL', () => {
    expect(() => upsertPayload('parts', [part({ price: null })])).toThrow(/gpu-x.*price/)
  })

  it('accepts a price of zero, which is a real value and not a missing one', () => {
    expect(() => upsertPayload('parts', [part({ price: 0 })])).not.toThrow()
  })

  it('refuses a row with no id, since the id is the conflict target', () => {
    expect(() => upsertPayload('parts', [part({ id: undefined })])).toThrow(/id/)
  })

  it('refuses a table it has no mapping for, rather than sending a bare payload', () => {
    expect(() => upsertPayload('feedback', [{ id: 'x' }])).toThrow(/feedback/)
  })

  it('states the mirrored columns per table', () => {
    expect(mirroredColumns('parts')).toEqual(['category', 'name', 'price'])
    expect(mirroredColumns('games')).toEqual(['name'])
  })
})
