// Prints how far the catalogue research has got.
//
//   npm run catalog:coverage
//
// Reads partsData.json and partSources.json, so it cannot drift from reality —
// there is no checklist for anybody to forget to update.
import { readFileSync } from 'node:fs'
import { EXPECTED, coverageFor } from './catalog-coverage-core.mjs'

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'))
const parts = read('src/data/partsData.json')
const sources = read('data/partSources.json')

for (const category of Object.keys(EXPECTED)) {
  const c = coverageFor(category, parts, sources)
  const pct = c.total === 0 ? 0 : Math.round((c.verified / c.total) * 100)
  console.log(`\n${category}: ${c.verified}/${c.total} parts fully researched (${pct}%)`)
  for (const [key, f] of Object.entries(c.fields)) {
    const tag = f.optional ? ' (optional)' : ''
    console.log(`  ${key.padEnd(20)} present ${String(f.present).padStart(3)}/${f.applies}   researched ${String(f.sourced).padStart(3)}/${f.applies}${tag}`)
  }
}
console.log('')
