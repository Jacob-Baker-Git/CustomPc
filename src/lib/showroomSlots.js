// The showroom helpers the page itself needs (labels, tap strip, build table).
// Kept free of three.js and assemblyGeometry: these load with the entry chunk,
// and the 3D-only maths lives in ./showroom.js, which only the lazy BuildCanvas
// chunk may import. Guarded by src/tests/entryBundleNo3d.test.js.
import { CATEGORIES } from './categories'

export const SHOWROOM_SLOTS = [
  ...['cooler', 'motherboard', 'storage', 'psu'].map((id) => ({ id, side: 'l' })),
  ...['ram', 'cpu', 'gpu'].map((id) => ({ id, side: 'r' })),
]

export const COMPACT_IDS = ['cpu', 'gpu', 'cooler', 'psu']

const anchoredIds = new Set(SHOWROOM_SLOTS.map((s) => s.id))
const priceOf = (o, id) => o?.parts?.[id]?.price ?? 0

export function focusChange(prevOption, option, changed) {
  const ids = CATEGORIES.map((c) => c.id).filter((id) => changed.has(id))
  if (!ids.length) return null
  const size = (id) => Math.abs(priceOf(option, id) - priceOf(prevOption, id))
  const anchored = ids.filter((id) => anchoredIds.has(id))
  const pool = anchored.length ? anchored : ids
  const id = pool.reduce((best, x) => (size(x) > size(best) ? x : best))
  return {
    id,
    part: option.parts?.[id],
    delta: priceOf(option, id) - priceOf(prevOption, id),
    others: ids.filter((x) => x !== id),
    anchored: anchored.length > 0,
  }
}

// Whole pounds, as PartSlot shows them, so prices agree side by side.
export const gbp = (n) => `£${Math.round(n ?? 0).toLocaleString('en-GB')}`

// Whole pounds: catalogue prices are fractional (579.99).
export function formatDelta(raw) {
  const n = Math.round(raw)
  if (n > 0) return `+£${n}`
  if (n < 0) return `\u2212£${-n}`
  return '£0'
}

export function priceShares(selectedParts) {
  const rows = CATEGORIES.filter((c) => selectedParts[c.id]).map((c) => ({ id: c.id, price: selectedParts[c.id].price ?? 0 }))
  const total = rows.reduce((s, r) => s + r.price, 0)
  return rows.map((r) => ({ ...r, pct: total ? Math.round((r.price / total) * 1000) / 10 : 0 }))
}

