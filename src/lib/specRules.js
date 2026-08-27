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
const RULES = []

export function evaluateSpecRules(selectedParts, candidate) {
  return aggregate(RULES.map((rule) => rule(selectedParts, candidate)))
}
