import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { MODEL_CREDITS } from '../lib/siteContent'

const shipped = readdirSync(resolve(process.cwd(), 'public/models'))
  .filter((f) => f.endsWith('.glb'))
  .sort()

// The 3D models are used under CC BY 4.0, which is not a formality: it requires
// crediting the author and naming the work, or the use is simply infringing.
// Shipping a mesh with no credit is the failure mode this file exists to catch —
// it had already happened twice (cpu.glb and fan.glb were both uncredited, and
// the page additionally claimed the fans were our own work).
describe('3D model attribution', () => {
  it('credits every model actually shipped in public/models', () => {
    const credited = MODEL_CREDITS.map((c) => c.file).sort()
    expect(credited).toEqual(shipped)
  })

  it('names an author and a work for every credit', () => {
    for (const c of MODEL_CREDITS) {
      expect(c.author, `${c.file} has no author`).toBeTruthy()
      expect(c.title, `${c.file} has no title`).toBeTruthy()
    }
  })

  it('does not credit a model that is not shipped', () => {
    for (const c of MODEL_CREDITS) {
      expect(shipped, `${c.file} is credited but not shipped`).toContain(c.file)
    }
  })

  // CC BY also asks for the source link where practicable. All eight were
  // recovered on 2026-08-01 by searching Sketchfab for the recorded author and
  // title; this now guards them rather than tolerating gaps.
  it('links a source for every credited model', () => {
    for (const c of MODEL_CREDITS) {
      expect(c.source, `${c.file} has no source link`).toBeTruthy()
      expect(c.source, `${c.file} source is not a Sketchfab URL`).toMatch(/^https:\/\/sketchfab\.com\/3d-models\//)
    }
  })
})
