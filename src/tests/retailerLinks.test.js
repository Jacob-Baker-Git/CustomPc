import { describe, it, expect } from 'vitest'
import { searchUrl } from '../lib/retailerLinks'

describe('retailerLinks', () => {
  it('builds an Amazon UK search URL with the encoded part name', () => {
    const url = searchUrl('AMD Ryzen 9 7950X')
    expect(url).toContain('amazon.co.uk/s?k=')
    expect(url).toContain(encodeURIComponent('AMD Ryzen 9 7950X'))
  })

  // The site has no affiliate relationship at all. This guards the decision
  // rather than a configuration: if a tag ever reappears here, the commission
  // disclosure has to come back with it, so failing loudly is the point.
  it('carries no affiliate tag or tracking parameter', () => {
    const url = searchUrl('Test Part')
    expect(url).not.toContain('tag=')
    expect(url).not.toContain('ref=')
    expect(url).toBe('https://www.amazon.co.uk/s?k=Test%20Part')
  })

  it('includes the brand in the query when provided', () => {
    const url = searchUrl('RTX 4070', 'NVIDIA')
    expect(url).toContain(encodeURIComponent('NVIDIA RTX 4070'))
  })
})
