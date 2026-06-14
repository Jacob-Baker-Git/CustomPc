import { ndcToPixel } from '../lib/projectToScreen'

describe('ndcToPixel', () => {
  it('maps NDC center (0,0) to the middle of the container', () => {
    expect(ndcToPixel(0, 0, 800, 600)).toEqual({ x: 400, y: 300 })
  })

  it('maps NDC top-left (-1, 1) to pixel (0, 0)', () => {
    expect(ndcToPixel(-1, 1, 800, 600)).toEqual({ x: 0, y: 0 })
  })

  it('maps NDC bottom-right (1, -1) to the far corner', () => {
    expect(ndcToPixel(1, -1, 800, 600)).toEqual({ x: 800, y: 600 })
  })

  it('flips the Y axis (NDC up = pixel down)', () => {
    expect(ndcToPixel(0, 1, 800, 600).y).toBe(0)
    expect(ndcToPixel(0, -1, 800, 600).y).toBe(600)
  })
})
