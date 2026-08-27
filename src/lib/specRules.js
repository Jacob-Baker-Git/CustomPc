// The compatibility rules that depend on specs researched to the standard in
// docs/superpowers/specs/2026-08-27-component-spec-schema-and-compatibility-design.md
//
// Every rule is a pure function (selectedParts, candidate) => null | {status, reason}.
// `null` means the rule does not apply to this pairing at all — a GPU rule
// against a candidate PSU, say. That is DIFFERENT from 'unverified', which means
// the rule applies and the data to run it is missing.
//
// ⚠️ Absent data must NEVER produce 'ok'. The whole point of this module is that
// the app stops claiming it checked things it could not check.

// Precedence: a real failure outranks an unrunnable check, which outranks
// silence. Without this, one satisfied rule would mask an unverified one.
const RANK = { blocked: 0, unverified: 1 }

export function aggregate(results) {
  const real = results.filter(Boolean)
  if (real.length === 0) return { status: 'ok', reason: '' }
  const worst = real.sort((a, b) => RANK[a.status] - RANK[b.status])[0]
  return { status: worst.status, reason: worst.reason }
}

// Rules are appended here as they are implemented.
const LABEL = { pcie8: '8-pin PCIe', pcie6: '6-pin PCIe', '12vhpwr': '16-pin 12VHPWR', eps8: '8-pin EPS' }

// Can `supply` satisfy every entry in `need`?
const covers = (supply, need) =>
  Object.entries(need).every(([type, count]) => (supply[type] ?? 0) >= count)

const missingFrom = (supply, need) =>
  Object.entries(need)
    .filter(([type, count]) => (supply[type] ?? 0) < count)
    .map(([type, count]) => `${count}x ${LABEL[type] ?? type}`)
    .join(', ')

// Rule 1. The PSU side and the GPU side are the same question asked from two
// directions, because either part can be the candidate.
function powerConnectors(selectedParts, candidate) {
  const psu = candidate.category === 'psu' ? candidate : selectedParts.psu
  const gpu = candidate.category === 'gpu' ? candidate : selectedParts.gpu
  if (!psu || !gpu) return null

  const need = gpu.specs?.powerConnectors
  const supply = psu.specs?.connectors
  if (!need) return { status: 'unverified', reason: `Power connectors for ${gpu.name ?? 'this GPU'} are not verified` }
  if (!supply) return { status: 'unverified', reason: `Connectors on ${psu.name ?? 'this PSU'} are not verified` }

  if (covers(supply, need)) return null

  // A bundled adapter is a legitimate second way to satisfy the card.
  const adapter = gpu.specs?.adapterFrom
  if (adapter && covers(supply, adapter)) return null

  return { status: 'blocked', reason: `PSU is missing ${missingFrom(supply, need)}` }
}

// Rule 1b. The board's EPS headers. A supply that can run the graphics card and
// not the CPU is just as dead a build.
function epsConnectors(selectedParts, candidate) {
  const psu = candidate.category === 'psu' ? candidate : selectedParts.psu
  const board = candidate.category === 'motherboard' ? candidate : selectedParts.motherboard
  if (!psu || !board) return null

  const need = board.specs?.epsConnectors
  const supply = psu.specs?.connectors
  if (typeof need !== 'number') return { status: 'unverified', reason: `EPS headers on ${board.name ?? 'this motherboard'} are not verified` }
  if (!supply) return { status: 'unverified', reason: `Connectors on ${psu.name ?? 'this PSU'} are not verified` }

  if ((supply.eps8 ?? 0) >= need) return null
  return { status: 'blocked', reason: `Board needs ${need}x 8-pin EPS; PSU has ${supply.eps8 ?? 0}` }
}

const RULES = [powerConnectors, epsConnectors]

export function evaluateSpecRules(selectedParts, candidate) {
  return aggregate(RULES.map((rule) => rule(selectedParts, candidate)))
}
