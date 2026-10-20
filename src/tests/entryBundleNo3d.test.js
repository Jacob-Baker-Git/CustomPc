import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { describe, it, expect } from 'vitest'

// three.js and the assembly geometry belong in the lazy BuildCanvas chunk only.
// One static `import` of them from page code (2026-10-20: showroom.js, through
// the Summary labels) pulls ~290 kB into the entry bundle that every visitor
// downloads, hub included. Walks the STATIC import graph from src/main.jsx —
// `import(...)` inside lazy() is the split point and is not followed — and
// fails on any reachable module that imports them.
const FORBIDDEN = [/^three(\/|$)/, /^@react-three\//, /assemblyGeometry(\.js)?$/]
const STATIC = /^\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm

function resolveLocal(from, spec) {
  const base = resolve(dirname(from), spec)
  return ['', '.js', '.jsx', '/index.js', '/index.jsx'].map((x) => base + x).find((p) => existsSync(p) && /\.jsx?$/.test(p))
}

function offenders(entry) {
  const seen = new Set()
  const bad = []
  const stack = [entry]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const m of code.matchAll(STATIC)) {
      const spec = m[1] ?? m[2]
      if (FORBIDDEN.some((re) => re.test(spec))) bad.push(`${file.replace(process.cwd(), '')} -> ${spec}`)
      if (spec.startsWith('.')) {
        const next = resolveLocal(file, spec)
        if (next) stack.push(next)
      }
    }
  }
  return { bad, count: seen.size }
}

describe('the entry bundle', () => {
  it('reaches no three.js, @react-three or assemblyGeometry by static import', () => {
    const { bad, count } = offenders(resolve(process.cwd(), 'src/main.jsx'))
    expect(count, 'the walk actually followed the app').toBeGreaterThan(50)
    expect(bad).toEqual([])
  })
})
