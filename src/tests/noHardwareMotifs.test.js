import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// The configurator redesign (spec 2026-10-16) retired the hardware motifs: the
// circuit-board background, the RAM-stick panels and the board designators.
// This keeps them from creeping back in through a copy-pasted component.
const SRC = join(process.cwd(), 'src')
const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== 'tests') walk(p) }
    else if (/\.(js|jsx)$/.test(name)) files.push(p)
  }
})(SRC)

const offenders = (pattern) =>
  files.filter((f) => pattern.test(readFileSync(f, 'utf8'))).map((f) => relative(process.cwd(), f))

describe('no hardware motifs', () => {
  it('has no circuit-board background', () => {
    expect(offenders(/BoardBackground|data-board/)).toEqual([])
  })
})
