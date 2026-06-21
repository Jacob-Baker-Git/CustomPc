import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('index.html metadata', () => {
  it('has a descriptive title, not the placeholder', () => {
    expect(html).not.toContain('<title>custompc</title>')
    expect(html).toMatch(/<title>[^<]*PC Builder[^<]*<\/title>/)
  })

  it('has description, Open Graph and Twitter card meta', () => {
    expect(html).toContain('name="description"')
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('name="twitter:card"')
  })

  it('paints a dark boot skeleton before JS loads', () => {
    expect(html).toContain('#05080f')
    expect(html).toMatch(/id="root">[\s\S]*class="boot"[\s\S]*<\/div>/)
  })
})
