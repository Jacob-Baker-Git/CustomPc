// Gzips dist/models/*.glb in place, keeping the names. Netlify serves .glb as
// application/octet-stream and never compresses it; the client unpacks these
// itself (src/lib/gzipGlb.js), so the wire cost roughly halves.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, constants } from 'node:zlib'

const dir = 'dist/models'
let before = 0
let after = 0
for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb'))) {
  const raw = readFileSync(`${dir}/${f}`)
  if (raw[0] === 0x1f && raw[1] === 0x8b) throw new Error(`${f} is already gzipped — refusing to double-wrap`)
  const gz = gzipSync(raw, { level: constants.Z_BEST_COMPRESSION })
  writeFileSync(`${dir}/${f}`, gz)
  before += raw.length
  after += gz.length
}
console.log(`gzip-models: ${(before / 1024 ** 2).toFixed(2)} MB → ${(after / 1024 ** 2).toFixed(2)} MB`)
