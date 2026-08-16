import { readdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import tailwindConfig from '../../tailwind.config.js'

// Tailwind can only compose an opacity modifier onto a colour it can take apart
// into channels. Every semantic colour here resolves to a bare `var(--x)` whose
// var holds a hex string, so `bg-surface/85` is not a translucent surface — it
// is NOTHING. Tailwind drops the utility silently: no error, no warning, no
// rule in the output. SEVEN of these were live when this landed, and the one on
// the flagged CategoryList row took its border colour down with it — with no
// `borderColor.DEFAULT` override in the config, that row drew Tailwind's default
// grey where red was specified.
//
// The failure is invisible in review (the class looks right), invisible in the
// build (it exits 0) and invisible in the browser unless you know the exact
// shade you were expecting. So it gets a test.
//
// The token list is read out of tailwind.config.js rather than restated, for
// the same reason paletteContrast.test.js reads index.css: a copy here would
// keep passing after the palette moved on. That also means this guard retires
// itself — convert the palette to channel form (`rgb(var(--x) / <alpha-value>)`)
// and these tokens stop being collected, because then the modifiers really work.
function collectBareVarTokens(colors, prefix = '') {
  const out = []
  for (const [key, value] of Object.entries(colors)) {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key
    if (typeof value === 'string') {
      // `<alpha-value>` is the placeholder Tailwind substitutes the modifier
      // into. A colour carrying it composes fine; a bare var() cannot.
      if (value.includes('var(') && !value.includes('<alpha-value>')) out.push(name)
    } else if (value && typeof value === 'object') {
      out.push(...collectBareVarTokens(value, name))
    }
  }
  return out
}

const TOKENS = collectBareVarTokens(tailwindConfig.theme.extend.colors)

// Prefixes that take a colour. The lazy `-[a-z]+` run lets a compound token
// (accent-ink) win over the short one nested inside it (ink).
const COLOR_PREFIX =
  '(?:bg|text|border|ring|divide|outline|decoration|placeholder|caret|fill|stroke|shadow|from|via|to)'

// Comments are stripped before scanning. `FrameRateRow.jsx` documents this very
// bug in prose and names `bg-surface-2/60` inside a backtick — flagging that
// would punish the file for explaining the trap, and the fix would be to delete
// the explanation. Prose about a dead class is not a dead class.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function violationsIn(source) {
  const alternation = TOKENS.map((t) => t.replace(/[-]/g, '\\-')).join('|')
  // Alpha is either a bare number (/85) or an arbitrary value (/[0.07]) — both
  // are dropped identically, so both have to be caught.
  const re = new RegExp(
    `(?<![\\w-])${COLOR_PREFIX}(?:-[a-z]+)*?-(?:${alternation})\\/(?:\\[[^\\]\\s]+\\]|\\d{1,3})`,
    'g',
  )
  return stripComments(source).split('\n').flatMap((line, i) => {
    const found = line.match(re) ?? []
    return found.map((cls) => ({ line: i + 1, cls }))
  })
}

// Only the shipped UI. src/tests is excluded so a test that asserts on a class
// name cannot trip the guard that protects it.
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

function allOffenders() {
  return sourceFiles(resolve(process.cwd(), 'src')).flatMap((file) =>
    violationsIn(readFileSync(file, 'utf8')).map(
      ({ cls }) => `${file.replace(/\\/g, '/').split('/src/')[1]} — ${cls}`,
    ),
  )
}

describe('opacity modifiers on semantic tokens (tailwind.config.js)', () => {
  it('collects the var-backed tokens from the real config', () => {
    // If this ever comes back empty the scan below passes vacuously, which
    // would be a silent failure of the thing built to stop silent failures.
    expect(TOKENS.length).toBeGreaterThan(0)
    expect(TOKENS).toContain('surface-2')
    expect(TOKENS).toContain('accent-ink')
  })

  it('catches a known-dead utility', () => {
    // Anchors the matcher on the real bug, including the arbitrary-value form
    // that the original sweep missed.
    expect(violationsIn('<div className="bg-surface/85" />')).toHaveLength(1)
    expect(violationsIn("'border-bad/60 bg-bad/[0.07]'")).toHaveLength(2)
    expect(violationsIn('<span className="bg-accent-ink/20" />')).toHaveLength(1)
  })

  it('does not flag whole tokens or unrelated palettes', () => {
    // bg-gold-soft is the supported way to get the wash bg-gold/15 wanted.
    expect(violationsIn('bg-gold-soft bg-surface-2 text-muted border-line')).toHaveLength(0)
    // Tailwind's own palette is real hex and composes alpha perfectly well.
    expect(violationsIn('bg-black/50 text-white/70')).toHaveLength(0)
  })

  it('ignores a dead class NAMED in a comment', () => {
    expect(violationsIn('// `bg-surface-2/60` is silently dead')).toHaveLength(0)
    expect(violationsIn('/* bg-surface/85 emits nothing */')).toHaveLength(0)
    expect(violationsIn('{/* bg-accent/15 was the intent */}')).toHaveLength(0)
    // …but a real class on the same line as a trailing comment still counts.
    expect(violationsIn('className="bg-surface/85" // the bug')).toHaveLength(1)
  })

  it('emits no opacity modifier on a var-backed token anywhere in src', () => {
    // No exemption list on purpose. Every violation is fixed at the call site;
    // an allowlist here would only be a place for the next one to hide.
    expect(allOffenders()).toEqual([])
  })
})
