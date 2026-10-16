import { render } from '@testing-library/react'
import Tag from '../components/ui/Tag'

describe('Tag', () => {
  it('wraps its text in brackets', () => {
    const { container } = render(<Tag>ultra / 1440p</Tag>)
    expect(container.textContent).toBe('[ ultra / 1440p ]')
  })
})
