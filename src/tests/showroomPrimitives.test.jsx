import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PartPictogram from '../components/showroom/PartPictogram.jsx'
import CropFrame from '../components/showroom/CropFrame.jsx'
import { CATEGORIES } from '../lib/categories.js'

describe('PartPictogram', () => {
  it.each(CATEGORIES.map((c) => c.id))('draws %s', (id) => {
    const { container } = render(<PartPictogram id={id} />)
    const svg = container.querySelector('svg[aria-hidden="true"]')
    expect(svg).not.toBeNull()
    expect(svg.children.length).toBeGreaterThan(0)
  })
})

describe('CropFrame', () => {
  it('renders children and four corner marks', () => {
    const { getByText, container } = render(<CropFrame><p>inside</p></CropFrame>)
    expect(getByText('inside')).toBeTruthy()
    expect(container.querySelectorAll('[data-crop-mark]')).toHaveLength(4)
  })
})
