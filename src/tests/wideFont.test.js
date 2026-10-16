import { describe, it, expect } from 'vitest'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// The headings' wide face is one static instance (width 125%) rather than the
// variable width axis, which src/fonts.css measured at +108 KB.
const css = readFileSync(resolve(process.cwd(), 'src/fonts.css'), 'utf8')
const FILE = resolve(process.cwd(), 'public/fonts/archivo-wide-latin.woff2')

describe('the wide display face', () => {
  it('is declared as its own family at width 125%', () => {
    const block = css.split('@font-face').find((b) => b.includes("'Archivo Wide'"))
    expect(block, 'no Archivo Wide @font-face').toBeTruthy()
    expect(block).toMatch(/font-stretch:\s*125%/)
    expect(block).toContain('url(/fonts/archivo-wide-latin.woff2)')
  })

  it('ships one small self-hosted file', () => {
    expect(existsSync(FILE)).toBe(true)
    expect(statSync(FILE).size).toBeLessThan(60_000)
  })
})
