import partsData from '../data/partsData.json'
import peripheralsData from '../data/peripheralsData.json'

const PART_BY_ID = new Map(partsData.map((p) => [p.id, p]))
const PERIPHERAL_BY_ID = new Map(peripheralsData.map((p) => [p.id, p]))

function toBase64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code) {
  return atob(code.replace(/-/g, '+').replace(/_/g, '/'))
}

export function encodeBuild({ budget, resolution, parts, peripherals }) {
  const p = {}
  for (const [cat, part] of Object.entries(parts || {})) if (part) p[cat] = part.id
  const x = {}
  for (const [cat, part] of Object.entries(peripherals || {})) if (part) x[cat] = part.id
  return toBase64Url(JSON.stringify({ b: budget || 0, r: resolution || '1440p', p, x }))
}

export function decodeBuild(code) {
  let payload
  try {
    payload = JSON.parse(fromBase64Url(code))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null

  const parts = {}
  for (const [cat, id] of Object.entries(payload.p || {})) {
    const part = PART_BY_ID.get(id)
    if (part) parts[cat] = part
  }
  const peripherals = {}
  for (const [cat, id] of Object.entries(payload.x || {})) {
    const part = PERIPHERAL_BY_ID.get(id)
    if (part) peripherals[cat] = part
  }
  return {
    budget: typeof payload.b === 'number' ? payload.b : 0,
    resolution: payload.r || '1440p',
    parts,
    peripherals,
  }
}
