import { readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, it, expect } from 'vitest'

// --accent is the brand, and the brand is the wordmark. It is the only fully
// saturated colour on the site, which is what makes it read as identity rather
// than as one more UI accent. The moment it starts marking selections or
// buttons again, that distinction is gone and the palette is back to
// near-black-plus-one-accent — the exact generic look this redesign replaced.
//
// State belongs to the metals: copper for action, gold for seated, tech for
// technical. See the mapping table in the plan.
//
// ⚠️ The allowance is per-SITE, not per-file. The plan proposed whitelisting
// TopBar.jsx and ErrorBoundary.jsx wholesale, which was wrong twice over: there
// are FOUR wordmark sites, and two of them (MainMenu, SiteChrome) sit in files
// full of ordinary UI that must stay guarded. A file-level pass would have left
// 11 unguarded sites in MainMenu alone. So a site opts in with an `@wordmark`
// marker on its own line or the two above it, and every other `accent` in `src`
// is a failure.
const MARKER = '@wordmark'
const MARKER_WINDOW = 2

// `accent-ink` is the text colour that sits ON a metal fill — it is not the
// brand and is allowed anywhere. Only bare `accent` is restricted.
//
// `fill` and `stroke` are in this list because they had to be: the feedback
// page's star rating used `fill-accent`, which the plan's original alternation
// did not cover. An SVG paint is exactly as visible as a background.
const ACCENT_CLASS =
  /(?<![\w-])(?:bg|text|border|ring|divide|outline|from|via|to|fill|stroke)-accent(?![\w-])/g

function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'tests') sourceFiles(path, acc)
    } else if (/\.(js|jsx)$/.test(entry.name)) acc.push(path)
  }
  return acc
}

function offendersIn(source, rel) {
  const lines = source.split(/\r?\n/)
  return lines.flatMap((line, i) => {
    const found = line.match(ACCENT_CLASS) ?? []
    if (found.length === 0) return []
    const from = Math.max(0, i - MARKER_WINDOW)
    const marked = lines.slice(from, i + 1).some((l) => l.includes(MARKER))
    return marked ? [] : found.map((cls) => `${rel}:${i + 1} — ${cls}`)
  })
}

function offenders() {
  return sourceFiles(resolve(process.cwd(), 'src')).flatMap((file) => {
    const rel = file.replace(/\\/g, '/').split('/src/')[1]
    return offendersIn(readFileSync(file, 'utf8'), rel)
  })
}

describe('the brand accent is reserved for the wordmark', () => {
  it('matches a bare accent class but not accent-ink', () => {
    expect('bg-accent'.match(ACCENT_CLASS)).toHaveLength(1)
    expect('text-accent-ink'.match(ACCENT_CLASS)).toBeNull()
    expect('border-accent'.match(ACCENT_CLASS)).toHaveLength(1)
    // The one the plan's alternation missed.
    expect('fill-accent'.match(ACCENT_CLASS)).toHaveLength(1)
    // Neither a longer token that merely starts with the same letters, nor a
    // hyphenated suffix, is the brand.
    expect('bg-accent-soft'.match(ACCENT_CLASS)).toBeNull()
    expect('text-accented'.match(ACCENT_CLASS)).toBeNull()
  })

  it('honours the marker only within its window', () => {
    const near = ['// @wordmark', '<span className="text-accent" />'].join('\n')
    expect(offendersIn(near, 'f.jsx')).toEqual([])

    // Three lines above is outside the window — a marker cannot licence a whole
    // component, only the site it sits on.
    const far = ['// @wordmark', '', '', '<span className="text-accent" />'].join('\n')
    expect(offendersIn(far, 'f.jsx')).toEqual(['f.jsx:4 — text-accent'])

    // A marker BELOW the site does not count either.
    const after = ['<span className="text-accent" />', '// @wordmark'].join('\n')
    expect(offendersIn(after, 'f.jsx')).toEqual(['f.jsx:1 — text-accent'])
  })

  it('appears nowhere outside the marked wordmark sites', () => {
    expect(offenders()).toEqual([])
  })

  it('still guards the files the wordmarks live in', () => {
    // The point of the per-site rule: a marker in MainMenu must not licence the
    // other eleven accent-free sites in the same file. If this ever finds zero
    // marked sites, the guard above has gone vacuous.
    const marked = sourceFiles(resolve(process.cwd(), 'src')).filter((f) =>
      readFileSync(f, 'utf8').includes(MARKER),
    )
    expect(marked).toHaveLength(4)
  })
})
