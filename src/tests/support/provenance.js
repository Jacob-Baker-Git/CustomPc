// Shared by the catalogue's schema guards.
//
// The contract those guards enforce is "every GPU carries a length", and it is
// a good contract: a part missing a field silently passes every check that
// field governs, which is how an incompatible part becomes selectable. But a
// handful of figures genuinely are not published anywhere — AMD retired the RX
// 5000-series pages and leaves the Length column blank on its own specification
// table — and the research standard says to delete a figure we cannot verify
// rather than carry a guess.
//
// So the contract becomes: every GPU carries a length, OR provenance records
// exactly why it cannot. Never simply absent.
//
// ⚠️ Lives under src/tests/ and NOT src/lib/, because data/partSources.json must
// never reach the browser — partSources.test.js enforces that. Vitest collects
// only `*.test.js` / `*.spec.js`, so this file is a helper, not a suite.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sources = JSON.parse(readFileSync(resolve(process.cwd(), 'data/partSources.json'), 'utf8'))

export const isUnverifiable = (partId, field) =>
  sources[partId]?.[field]?.result === 'unverifiable'

// "This field is present, or we have written down why it never will be."
export const accountedFor = (part, field, present = typeof part[field] === 'number') =>
  present || isUnverifiable(part.id, field)
