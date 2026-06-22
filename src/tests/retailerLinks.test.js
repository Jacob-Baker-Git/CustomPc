import { describe, it, expect } from 'vitest'
import { searchUrl } from '../lib/retailerLinks'

describe('retailerLinks', () => {
  it('builds an Amazon UK search URL with the encoded part name', () => {
    const url = searchUrl('AMD Ryzen 9 7950X')
    expect(url).toContain('amazon.co.uk/s?k=')
    expect(url).toContain(encodeURIComponent('AMD Ryzen 9 7950X'))
  })

  it('does not append an affiliate tag when none is configured', () => {
    expect(searchUrl('Test Part')).not.toContain('&tag=')
  })

  it('includes the brand in the query when provided', () => {
    const url = searchUrl('RTX 4070', 'NVIDIA')
    expect(url).toContain(encodeURIComponent('NVIDIA RTX 4070'))
  })
})
