import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync, constants } from 'node:zlib'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { MODEL_PAYLOAD_MB } from '../lib/modelPayload'

// The figure in MODEL_PAYLOAD_MB is shown to people deciding whether to spend
// their mobile data. If a model is re-exported and the constant is not updated,
// the app goes on quoting a number that is no longer true — the failure mode is
// silent, and it is a claim about someone's data allowance.
describe('the stated 3D download size', () => {
  const dir = resolve(process.cwd(), 'public/models')
  const files = readdirSync(dir).filter((f) => f.endsWith('.glb'))
  // Gzipped as scripts/gzip-models.mjs ships them — that is the wire cost.
  const gz = (f) => gzipSync(readFileSync(resolve(dir, f)), { level: constants.Z_BEST_COMPRESSION }).length
  const totalMb = files.reduce((sum, f) => sum + gz(f), 0) / 1024 ** 2

  it('has models to measure in the first place', () => {
    // Without this the sum is 0 and "within half a MB" would simply be false,
    // but a future glob change could make it vacuously pass some other way.
    expect(files.length).toBeGreaterThan(0)
  })

  it(`matches what public/models weighs on the wire (${totalMb.toFixed(2)} MB)`, () => {
    // Rounded to a whole MB in the copy, so allow half a MB either way and no
    // more — enough for a re-export that barely moves, not enough to let the
    // number drift into a lie.
    expect(Math.abs(totalMb - MODEL_PAYLOAD_MB)).toBeLessThan(0.5)
  })
})
