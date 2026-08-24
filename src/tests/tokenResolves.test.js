import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { describe, it, expect, beforeAll } from 'vitest'

// The blind spot in tokenOpacity.test.js, closed.
//
// That guard builds its matcher OUT OF the Tailwind config, which is what makes
// it self-retiring — but it also means a class whose token has been REMOVED from
// the config is invisible to it. `bg-accent-soft/40` returns zero violations the
// moment `accent.soft` is gone, because the token is no longer in the
// alternation. It proves "no live token carries a dead modifier"; it cannot
// prove "every class in src resolves to a live token". This file proves the
// second half.
//
// It matters because a dead colour utility is not a no-op. Tailwind emits
// nothing for it, silently, and the build still exits 0 — so the element keeps
// whatever it inherited, and for `border-*` that is Tailwind's default grey
// rather than no border at all. Sixteen dead `bg-accent-soft` sites lived
// through a whole redesign; they were caught by the migration that removed the
// token, not by any test.
//
// The oracle is the compiler itself. Asking "does this class emit a rule?"
// is the only question with an authoritative answer — a hand-written list of
// which suffixes are colours and which are sizes would rot against both
// Tailwind's palette and this repo's.
const TAILWIND_CLI = resolve(process.cwd(), 'node_modules/tailwindcss/lib/cli.js')

// Matches the prefix list in tokenOpacity.test.js. Arbitrary values (`text-[11px]`)
// and opacity modifiers (`bg-surface/85`) are excluded by the trailing lookahead:
// the first always resolve, and the second are the other guard's job.
const COLOR_PREFIX =
  '(?:bg|text|border|ring|divide|outline|decoration|placeholder|caret|fill|stroke|shadow|from|via|to)'
const CLASS_RE = new RegExp(
  `(?<![\\w-])${COLOR_PREFIX}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?![\\w\\-\\[/])`,
  'g',
)

// Same reason as the sibling guard: prose naming a dead class is not a dead
// class, and punishing a file for documenting the trap makes deleting the
// explanation the cheapest fix.
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'tests') sourceFiles(path, acc)
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      acc.push(path)
    }
  }
  return acc
}

function collectClasses() {
  const found = new Map()
  for (const file of sourceFiles(resolve(process.cwd(), 'src'))) {
    const where = file.replace(/\\/g, '/').split('/src/')[1]
    for (const cls of stripComments(readFileSync(file, 'utf8')).match(CLASS_RE) ?? []) {
      if (!found.has(cls)) found.set(cls, where)
    }
  }
  return found
}

// ⚠️ The emitted CSS is UNMINIFIED — `.bg-surface {`, with a space before the
// brace. A `\.cls\{` pattern therefore returns nothing for LIVE classes too and
// the whole check passes while reporting every class dead. Hence a lookahead on
// "not a class-name character" rather than on any particular delimiter, and
// hence the two control classes below.
const emits = (css, cls) =>
  new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?![\\w-])`).test(css)

const LIVE_CONTROL = 'bg-surface'
// The exact class that exposed the blind spot: `accent.soft` was removed from
// the config, so this resolves to nothing and must be seen to resolve to
// nothing. If the palette ever gains an `accent-soft` again, this control has
// to move to another removed token — not be deleted.
const DEAD_CONTROL = 'bg-accent-soft'

let css = ''
let classes = new Map()

beforeAll(() => {
  classes = collectClasses()
  const dir = mkdtempSync(join(tmpdir(), 'custompc-tw-'))
  try {
    const probe = join(dir, 'probe.html')
    const input = join(dir, 'in.css')
    const output = join(dir, 'out.css')
    writeFileSync(
      probe,
      `<div class="${[...classes.keys(), LIVE_CONTROL, DEAD_CONTROL].join(' ')}"></div>`,
    )
    // Utilities only. The base/components layers would drag in preflight and
    // every rule in index.css, and a match against those would be a false pass.
    writeFileSync(input, '@tailwind utilities;')
    execFileSync(
      process.execPath,
      [TAILWIND_CLI, '-c', 'tailwind.config.js', '-i', input, '-o', output, '--content', probe],
      { stdio: 'pipe', cwd: process.cwd() },
    )
    css = readFileSync(output, 'utf8')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}, 120000)

describe('every colour class in src resolves to a live token', () => {
  it('has a working oracle in both directions', () => {
    // Without this pair the scan below can pass by finding nothing and by
    // matching nothing — the two failure modes that make a guard worse than no
    // guard, because it reports "clean".
    expect(css.length, 'the Tailwind CLI produced no CSS at all').toBeGreaterThan(0)
    expect(emits(css, LIVE_CONTROL), `${LIVE_CONTROL} is a live token and must emit`).toBe(true)
    expect(emits(css, DEAD_CONTROL), `${DEAD_CONTROL} names a removed token and must NOT emit`).toBe(false)
  })

  it('found classes to check', () => {
    expect(classes.size).toBeGreaterThan(0)
    expect([...classes.keys()]).toContain('text-muted')
  })

  it('leaves no class naming a token the config no longer has', () => {
    const dead = [...classes.entries()]
      .filter(([cls]) => !emits(css, cls))
      .map(([cls, where]) => `${where} — ${cls}`)
    expect(dead).toEqual([])
  })
})
