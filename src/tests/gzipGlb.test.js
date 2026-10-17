// @vitest-environment node
import { gzipSync } from 'node:zlib'
import { describe, it, expect } from 'vitest'
import { gunzipIfNeeded } from '../lib/gzipGlb'

const glb = Uint8Array.from([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]) // "glTF" v2
const ab = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)

describe('gunzipIfNeeded', () => {
  it('unpacks a gzipped GLB, as production serves it', async () => {
    const out = await gunzipIfNeeded(ab(gzipSync(glb)))
    expect(new Uint8Array(out)).toEqual(glb)
  })

  it('passes a plain GLB through untouched, as dev serves it', async () => {
    const buf = ab(glb)
    expect(await gunzipIfNeeded(buf)).toBe(buf)
  })
})
