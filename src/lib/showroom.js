import * as THREE from 'three'
import { CATEGORIES } from './categories'
import { partCentre } from './assemblyGeometry'
import { sizeOverrides } from './partOverrides'

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

export function formatDelta(n) {
  if (n > 0) return `+£${n}`
  if (n < 0) return `\u2212£${-n}`
  return '£0'
}

export function priceShares(selectedParts) {
  const rows = CATEGORIES.filter((c) => selectedParts[c.id]).map((c) => ({ id: c.id, price: selectedParts[c.id].price ?? 0 }))
  const total = rows.reduce((s, r) => s + r.price, 0)
  return rows.map((r) => ({ ...r, pct: total ? Math.round((r.price / total) * 1000) / 10 : 0 }))
}

export function projectAnchor(world, camera) {
  const v = new THREE.Vector3(...world).project(camera)
  const x = (v.x * 0.5 + 0.5) * 100
  const y = (-v.y * 0.5 + 0.5) * 100
  return { x, y, visible: v.z <= 1 && x >= 0 && x <= 100 && y >= 0 && y <= 100 }
}

// World-unit nudges from partCentre onto a face the camera can see (1 wu =
// 122 mm). The bbox centre of these three sits somewhere you cannot point at:
// the AIO's box spans pump to roof radiator, so its centre is empty air; the
// card's and the PSU's centres are buried mid-body. Picked by eye in the
// browser from the default and orbited views — see the Task 4 report.
export const ANCHOR_OFFSET = {
  cooler: [0, 0.55, 0],
  gpu: [0, 0, 0.4],
  psu: [0, 0, 0.55],
}

export function anchorWorldPoint(id, parts) {
  const off = ANCHOR_OFFSET[id] ?? [0, 0, 0]
  return partCentre(id, sizeOverrides(parts)).map((v, i) => v + off[i])
}
