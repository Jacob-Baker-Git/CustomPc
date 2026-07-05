import useCatalogStore from '../store/useCatalogStore'

// Looked up at decode time (not module load) so saved builds resolve against
// the live Supabase catalog once it replaces the bundled snapshot.
const partById = (id) => useCatalogStore.getState().parts.find((p) => p.id === id)
const peripheralById = (id) => useCatalogStore.getState().peripherals.find((p) => p.id === id)

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
    const part = partById(id)
    if (part) parts[cat] = part
  }
  const peripherals = {}
  for (const [cat, id] of Object.entries(payload.x || {})) {
    const part = peripheralById(id)
    if (part) peripherals[cat] = part
  }
  return {
    budget: typeof payload.b === 'number' ? payload.b : 0,
    resolution: payload.r || '1440p',
    parts,
    peripherals,
  }
}
