import { render } from '@testing-library/react'
import { it, expect } from 'vitest'
import SiteChrome from '../components/SiteChrome'

it('a wide page gets a desktop-width main column', () => {
  const { container } = render(<SiteChrome wide onBack={() => {}}><p>x</p></SiteChrome>)
  expect(container.querySelector('main').className).toMatch(/lg:max-w-6xl/)
})
it('pages stay narrow by default', () => {
  const { container } = render(<SiteChrome onBack={() => {}}><p>x</p></SiteChrome>)
  expect(container.querySelector('main').className).not.toMatch(/max-w-6xl/)
})
