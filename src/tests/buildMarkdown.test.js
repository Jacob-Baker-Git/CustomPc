import { describe, it, expect } from 'vitest'
import { buildMarkdown } from '../lib/buildMarkdown'

describe('buildMarkdown', () => {
  it('renders a header and separator row', () => {
    const md = buildMarkdown([{ label: 'CPU', name: 'Ryzen 7 7800X3D', price: 349 }], 349)
    expect(md).toContain('| Component | Part | Price |')
    expect(md).toContain('| --- | --- | --- |')
  })

  it('formats each part row with a GBP price to two decimals', () => {
    const md = buildMarkdown([{ label: 'GPU', name: 'RTX 4070', price: 549.9 }], 549.9)
    expect(md).toContain('| GPU | RTX 4070 | £549.90 |')
  })

  it('ends with a bold total row', () => {
    const md = buildMarkdown([{ label: 'CPU', name: 'X', price: 100 }], 100)
    expect(md.trim().endsWith('| **Total** |  | **£100.00** |')).toBe(true)
  })
})
