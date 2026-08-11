// Proves a cell-key migration moved no fitted constant.
//
//   node scripts/compare-perf-model.mjs <before.json> <after.json>
//
// Adding upscaling to the cell key re-partitions NOTHING while every cell is
// already internally consistent on upscaling — each cell keeps exactly the rows
// it had, under a longer name. So every A, B, lowBase, sources and cv must come
// out identical, and any movement is a bug in the migration rather than a
// consequence of it.
//
// Keys are compared after stripping the upscaling tail, so "kino" (before) and
// "kino|native" (after) are recognised as the same cell. If the AFTER side
// splits one before-cell into two, that is reported rather than hidden — it
// means the corpus was mixing render scales and the migration changed a number.
import { readFileSync } from 'node:fs'
import { argv, exit } from 'node:process'

const [, , beforePath, afterPath] = argv
if (!beforePath || !afterPath) {
  console.error('usage: node scripts/compare-perf-model.mjs <before.json> <after.json>')
  exit(2)
}

const before = JSON.parse(readFileSync(beforePath, 'utf8'))
const after = JSON.parse(readFileSync(afterPath, 'utf8'))

const FIELDS = ['A', 'B', 'lowBase', 'lowSources', 'sources', 'cv']
const problems = []

// gameId|resolution|presetId -> [cell, ...]. An array, not a single value: if
// the after side has split a cell by render scale the count differs, and that is
// exactly what this has to surface.
function cells(model) {
  const out = new Map()
  for (const [gameId, byRes] of Object.entries(model.gameConst ?? {})) {
    for (const [res, byLeaf] of Object.entries(byRes)) {
      for (const [leaf, cell] of Object.entries(byLeaf)) {
        const presetId = leaf.split('|')[0]
        const key = `${gameId}|${res}|${presetId}`
        if (!out.has(key)) out.set(key, [])
        out.get(key).push(cell)
      }
    }
  }
  return out
}

const a = cells(before)
const b = cells(after)

for (const key of a.keys()) if (!b.has(key)) problems.push(`cell vanished: ${key}`)
for (const key of b.keys()) if (!a.has(key)) problems.push(`cell appeared: ${key}`)

for (const [key, listA] of a) {
  const listB = b.get(key)
  if (!listB) continue
  if (listA.length !== listB.length) {
    problems.push(`${key}: ${listA.length} cell(s) became ${listB.length} — ` +
                  'the corpus was mixing render scales here')
    continue
  }
  for (let i = 0; i < listA.length; i++) {
    for (const f of FIELDS) {
      if (listA[i][f] !== listB[i][f]) {
        problems.push(`${key}.${f}: ${listA[i][f]} -> ${listB[i][f]}`)
      }
    }
  }
}

// The index tables and the exact table have to be untouched too. A cell-key
// change that quietly dropped a part would still pass the cell comparison.
for (const side of ['gpuIndex', 'cpuIndex']) {
  const keysA = Object.keys(before[side] ?? {}).sort().join(',')
  const keysB = Object.keys(after[side] ?? {}).sort().join(',')
  if (keysA !== keysB) problems.push(`${side} membership changed`)
  for (const id of Object.keys(before[side] ?? {})) {
    if (JSON.stringify(before[side][id]) !== JSON.stringify(after[side]?.[id])) {
      problems.push(`${side}.${id} moved`)
    }
  }
}

const exactA = Object.keys(before.exact ?? {}).length
const exactB = Object.keys(after.exact ?? {}).length
if (exactA !== exactB) problems.push(`exact table: ${exactA} rows -> ${exactB}`)

// Same treatment for the exact table's values, matched after stripping the tail.
const strip = (k) => k.split('|').slice(0, 5).join('|')
const exactBefore = new Map(Object.entries(before.exact ?? {}).map(([k, v]) => [strip(k), v]))
for (const [k, v] of Object.entries(after.exact ?? {})) {
  const prev = exactBefore.get(strip(k))
  if (!prev) { problems.push(`exact row appeared: ${k}`); continue }
  if (prev.frameTimeMs !== v.frameTimeMs || prev.entries !== v.entries) {
    problems.push(`exact ${strip(k)}: ${prev.frameTimeMs} -> ${v.frameTimeMs}`)
  }
}

if (problems.length) {
  console.error(`MIGRATION GATE FAILED — ${problems.length} difference(s):\n`)
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`)
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`)
  exit(1)
}
console.log(`Gate passed: ${a.size} cells, ${exactA} exact rows and both index ` +
            'tables identical across the key change.')
