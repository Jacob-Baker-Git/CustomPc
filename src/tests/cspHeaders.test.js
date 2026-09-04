import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')

// Parse the Netlify _headers file into { pathPattern: { headerName: value } }.
// A path rule is a non-indented, non-comment line; the indented lines under it
// are its headers. Comments (indented or not) start with '#'.
const parseHeaderBlocks = (text) => {
  const blocks = {}
  let current = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (!/^\s/.test(raw)) {
      current = line
      blocks[current] = {}
    } else if (current) {
      const idx = line.indexOf(':')
      if (idx > -1) blocks[current][line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
  return blocks
}

const cspLine = headers
  .split('\n')
  .map((line) => line.trim())
  .find((line) => line.startsWith('Content-Security-Policy:'))

// Index the policy by directive so each assertion can name what it needs.
const directives = Object.fromEntries(
  (cspLine ?? '')
    .slice('Content-Security-Policy:'.length)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...values] = part.split(/\s+/)
      return [name, values]
    }),
)

// The dev server sends no CSP at all, so a policy that breaks the 3D view looks
// perfectly fine on localhost and only shows up once deployed — where every
// textured part silently degrades to its procedural primitive. These lock in
// what the GLTF pipeline actually needs at runtime.
describe('production CSP (public/_headers)', () => {
  it('declares a policy', () => {
    expect(cspLine).toBeTruthy()
  })

  it('lets GLTF textures be fetched from blob: URLs', () => {
    // GLTFLoader extracts embedded textures into blob: URLs and reads them back
    // through ImageBitmapLoader, which uses fetch() — governed by connect-src,
    // NOT img-src. A single blocked texture rejects the whole parse (three-stdlib
    // rethrows), so the entire model drops to its box primitive.
    expect(directives['connect-src']).toContain('blob:')
  })

  it('lets the meshopt decoder compile WebAssembly', () => {
    // motherboard.glb requires EXT_meshopt_compression, whose decoder compiles
    // WASM. 'wasm-unsafe-eval' permits exactly that, without allowing JS eval().
    expect(directives['script-src']).toContain("'wasm-unsafe-eval'")
  })

  it('keeps blob: allowed for images and workers the decoders spawn', () => {
    expect(directives['img-src']).toContain('blob:')
    expect(directives['worker-src']).toContain('blob:')
  })

  it('does not loosen the policy into arbitrary eval or remote scripts', () => {
    // Guards the fix above from being "fixed" again with a bigger hammer.
    expect(directives['script-src']).not.toContain("'unsafe-eval'")
    expect(directives['script-src']).not.toContain("'unsafe-inline'")
    expect(directives['script-src']).toContain("'self'")
    expect(directives['object-src']).toContain("'none'")
  })

  // Fonts are self-hosted (src/fonts.css + public/fonts). Pulling them from
  // Google again would send every visitor's IP to a third party before they
  // consent to anything, so the policy is what stops it coming back by accident.
  it('allows no third-party host except the Supabase catalog API', () => {
    const hosts = Object.values(directives)
      .flat()
      .filter((v) => v.startsWith('http'))
    expect(hosts).toEqual(['https://igeggndtnmdpauxovnwv.supabase.co'])
  })

  it('serves fonts only from our own origin', () => {
    expect(directives['font-src']).toEqual(["'self'"])
  })

  it('sends HSTS so the first request cannot be downgraded to HTTP', () => {
    const hsts = headers
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().startsWith('strict-transport-security:'))
    expect(hsts).toBeTruthy()
    // A year, in seconds. Anything shorter narrows the protection window.
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1])
    expect(maxAge).toBeGreaterThanOrEqual(31536000)
  })
})

// Netlify's default is `public, max-age=0, must-revalidate`, i.e. a conditional
// request per asset on every visit. Vite content-hashes /assets/* filenames, so
// their bytes never change under a given URL — those are safe to pin forever.
// Fonts and models are NOT hashed (fixed paths in public/), so `immutable` there
// would strand a stale copy in every cache until the filename itself changed.
describe('production caching (public/_headers)', () => {
  const blocks = parseHeaderBlocks(headers)

  it('pins content-hashed /assets/* immutably', () => {
    const cc = blocks['/assets/*']?.['Cache-Control'] ?? ''
    expect(cc).toMatch(/immutable/)
    // A year at least; anything shorter re-fetches bytes that cannot change.
    const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1])
    expect(maxAge).toBeGreaterThanOrEqual(31536000)
  })

  it('does NOT mark the unhashed fonts or models immutable', () => {
    // Guards the caveat above: an immutable rule on a fixed path means an update
    // to that file never reaches anyone whose browser already cached it.
    for (const path of ['/fonts/*', '/models/*']) {
      const cc = blocks[path]?.['Cache-Control'] ?? ''
      expect(cc).not.toMatch(/immutable/)
    }
  })
})
