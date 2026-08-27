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

// Rule 2. Card thickness against the case's expansion-slot budget. This is the
// clearance that `maxGpuLength` does not cover: a 4-slot card can be short
// enough to fit lengthwise and still foul the bottom of the case.
function gpuThickness(selectedParts, candidate) {
  const pcCase = candidate.category === 'case' ? candidate : selectedParts.case
  const gpu = candidate.category === 'gpu' ? candidate : selectedParts.gpu
  if (!pcCase || !gpu) return null

  const thick = gpu.specs?.slotsThick
  const budget = pcCase.specs?.expansionSlots
  if (typeof thick !== 'number') return { status: 'unverified', reason: `Slot thickness for ${gpu.name ?? 'this GPU'} is not verified` }
  if (typeof budget !== 'number') return { status: 'unverified', reason: `Expansion slots on ${pcCase.name ?? 'this case'} are not verified` }

  if (thick <= budget) return null
  return { status: 'blocked', reason: `GPU needs ${thick} slots; case has ${budget}` }
}

// Rule 3. ⚠️ "Does ANY slot on this board accept this drive", NOT slot
// allocation. A build holds exactly one part per category, so there is never a
// second drive competing for a slot.
function m2Interface(selectedParts, candidate) {
  const board = candidate.category === 'motherboard' ? candidate : selectedParts.motherboard
  const storage = candidate.category === 'storage' ? candidate : selectedParts.storage
  if (!board || !storage) return null

  // A 2.5in SATA drive needs a SATA port, not an M.2 slot. Different question,
  // same rule, because both answer "can this board physically attach it".
  if (!/nvme|m\.2/i.test(storage.storageType ?? '')) {
    const ports = board.specs?.sataPorts
    if (typeof ports !== 'number') return { status: 'unverified', reason: `SATA ports on ${board.name ?? 'this motherboard'} are not verified` }
    if (ports > 0) return null
    return { status: 'blocked', reason: 'This board has no SATA ports' }
  }

  const slots = board.specs?.m2Slots
  if (!Array.isArray(slots)) return { status: 'unverified', reason: `M.2 slots on ${board.name ?? 'this motherboard'} are not verified` }

  const needsSata = storage.specs?.m2Sata === true
  const usable = slots.filter((s) => (needsSata ? s.sata === true : true))
  if (usable.length > 0) return null

  return {
    status: 'blocked',
    reason: needsSata
      ? 'This is a SATA M.2 drive; no M.2 slot on this board accepts SATA'
      : 'This board has no M.2 slot',
  }
}

// Rule 4. AIOs only — an air cooler is already governed by maxCoolerHeight in
// compatibility.js.
//
// ⚠️ Reads `radiatorMm` (a number), NOT the existing `specs.radiator` string
// ("240mm") that all 22 catalogue AIOs carry. Those strings predate the research
// standard and have not been verified against a manufacturer page, so this rule
// deliberately reports `unverified` for them until the follow-on task does that
// work. Treating an unverified string as verified is the exact error the
// standard exists to prevent.
function radiatorFit(selectedParts, candidate) {
  const pcCase = candidate.category === 'case' ? candidate : selectedParts.case
  const cooler = candidate.category === 'cooler' ? candidate : selectedParts.cooler
  if (!pcCase || !cooler) return null
  if (cooler.specs?.type !== 'AIO') return null

  const size = cooler.specs?.radiatorMm
  const support = pcCase.specs?.radiatorSupport
  if (typeof size !== 'number') return { status: 'unverified', reason: `Radiator size for ${cooler.name ?? 'this cooler'} is not verified` }
  if (!support) return { status: 'unverified', reason: `Radiator support in ${pcCase.name ?? 'this case'} is not verified` }

  const fitsSomewhere = Object.values(support).some((sizes) => Array.isArray(sizes) && sizes.includes(size))
  if (fitsSomewhere) return null
  return { status: 'blocked', reason: `No mount in this case takes a ${size}mm radiator` }
}

const RULES = [powerConnectors, epsConnectors, gpuThickness, m2Interface, radiatorFit]

export function evaluateSpecRules(selectedParts, candidate) {
  return aggregate(RULES.map((rule) => rule(selectedParts, candidate)))
}
