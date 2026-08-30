// The repo's JSON style: JSON.stringify(x, null, 2), except that an object
// whose values are ALL primitives collapses onto one line once it is deep
// enough. Arrays always expand.
//
// The depth threshold differs per file, which is why it is a parameter:
//   partsData.json   3 - a part (depth 1) and its `specs` (depth 2) expand,
//                        but `powerConnectors` inside specs inlines.
//   partSources.json 2 - a part id (depth 1) expands, each spec entry inlines.
//
// Both are proved byte-for-byte by the round-trip below before any write.
import { readFileSync } from 'node:fs'

const isPrimitive = (v) => v === null || typeof v !== 'object'
const isFlat = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isPrimitive)

export function houseStringify(value, minInline, indent = 0) {
  const pad = '  '.repeat(indent)
  const padIn = '  '.repeat(indent + 1)

  if (isPrimitive(value)) return JSON.stringify(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => padIn + houseStringify(v, minInline, indent + 1))
    return `[\n${items.join(',\n')}\n${pad}]`
  }

  const keys = Object.keys(value)
  // ⚠️ An empty object inlines as `{  }` - two spaces. That is what the inline
  // template below produces for zero keys, and it is what is already in the
  // file (several GPUs carry `"powerConnectors": {  }`). Do not "tidy" it.
  if (keys.length === 0) return indent >= minInline ? '{  }' : '{}'
  if (isFlat(value) && indent >= minInline) {
    return `{ ${keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(value[k])}`).join(', ')} }`
  }
  const entries = keys.map(
    (k) => `${padIn}${JSON.stringify(k)}: ${houseStringify(value[k], minInline, indent + 1)}`
  )
  return `{\n${entries.join(',\n')}\n${pad}}`
}

export const FILES = {
  'src/data/partsData.json': 3,
  'data/partSources.json': 2,
}

export const toFile = (obj, minInline) =>
  houseStringify(obj, minInline).replace(/\n/g, '\r\n') + '\r\n'

export function roundTripOk(verbose = false) {
  let ok = true
  for (const [path, minInline] of Object.entries(FILES)) {
    const original = readFileSync(path, 'utf8')
    const same = toFile(JSON.parse(original), minInline) === original
    ok = ok && same
    if (verbose) console.log(`${same ? 'MATCH  ' : 'DIFFERS'} ${path}`)
    if (!same && verbose) {
      const a = original.split('\r\n')
      const b = toFile(JSON.parse(original), minInline).split('\r\n')
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          console.log(`  first diff line ${i + 1}\n    original: ${JSON.stringify(a[i])}\n    mine    : ${JSON.stringify(b[i])}`)
          break
        }
      }
    }
  }
  return ok
}

if (process.argv[1].endsWith('house-json.mjs')) process.exit(roundTripOk(true) ? 0 : 1)
