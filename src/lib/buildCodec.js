import useCatalogStore from '../store/useCatalogStore'
import { CATEGORIES } from './categories'

// Looked up at decode time (not module load) so saved builds resolve against
// the live Supabase catalog once it replaces the bundled snapshot.
const partById = (id) => useCatalogStore.getState().parts.find((p) => p.id === id)
const peripheralById = (id) => useCatalogStore.getState().peripherals.find((p) => p.id === id)

// A share code comes from a stranger's URL, so decode treats it as hostile.
//
// The cap is the important one: without it, `?build=<megabytes>` makes the
// victim's browser atob + JSON.parse the lot on the main thread the moment they
// click the link. A full build — every part and peripheral — encodes to a few
// hundred characters, so this leaves an order of magnitude of headroom.
export const MAX_SHARE_CODE_LENGTH = 4096

// Resolution is the one field that isn't checked against the catalog, and it
// reaches both the FPS maths and the rendered labels. The app itself only ever
// produces these three, so anything else is someone hand-editing the URL.
const RESOLUTIONS = ['1080p', '1440p', '4k']

// Budgets drive the auto-builder and get rendered as currency; negatives, NaN
// and 1e308 all produce nonsense downstream.
const MAX_BUDGET = 1e7

// Category keys are used as object keys, and JSON.parse makes `__proto__` a real
// own property (an object literal does not), so an unchecked `parts[cat] = part`
// reassigns the prototype of the parts object. Object.prototype is never reached
// and this is not XSS, but a link could still swap a prototype and inject a junk
// row into the parts list. Allow-listing the keys closes both.
const PART_CATEGORIES = new Set(CATEGORIES.map((c) => c.id))
const PERIPHERAL_CATEGORIES = new Set(['monitor', 'keyboard', 'mouse', 'headset'])

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
  if (typeof code !== 'string' || code.length > MAX_SHARE_CODE_LENGTH) return null

  let payload
  try {
    payload = JSON.parse(fromBase64Url(code))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null

  const parts = {}
  for (const [cat, id] of Object.entries(payload.p || {})) {
    if (!PART_CATEGORIES.has(cat)) continue
    const part = partById(id)
    if (part) parts[cat] = part
  }
  const peripherals = {}
  for (const [cat, id] of Object.entries(payload.x || {})) {
    if (!PERIPHERAL_CATEGORIES.has(cat)) continue
    const part = peripheralById(id)
    if (part) peripherals[cat] = part
  }
  const budget = Number(payload.b)
  return {
    budget: Number.isFinite(budget) && budget > 0 ? Math.min(budget, MAX_BUDGET) : 0,
    resolution: RESOLUTIONS.includes(payload.r) ? payload.r : '1440p',
    parts,
    peripherals,
  }
}
