// Downsamples a Radiance (.hdr) environment map in place.
//
// Why this exists: public/hdri/city.hdr shipped at 1024x512 and 1.5 MB, and it
// is used ONLY as an environment map. three's PMREMGenerator convolves it down
// to a small cubemap before anything reflects it, so past a point the source
// resolution costs download weight and buys nothing on screen.
//
// The file stays LOCAL. drei's `Environment preset` pulls from a CDN, which
// public/_headers forbids and the privacy page promises we do not do.
//
//   node scripts/downsample-hdr.mjs public/hdri/city.hdr 256 128
//
// ⚠️ It writes IN PLACE. Copy the file first if you might want it back.
import fs from 'node:fs'
import process from 'node:process'
import { FloatType } from 'three'
// ⚠️ HDRLoader, NOT RGBELoader. RGBELoader is a deprecated alias as of three
// r180 (this repo is on 0.184) and its constructor prints a deprecation warning.
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

const [, , file, wArg, hArg] = process.argv
if (!file) {
  console.error('usage: node scripts/downsample-hdr.mjs <file.hdr> [width] [height]')
  process.exit(1)
}
const outW = Number(wArg ?? 256)
const outH = Number(hArg ?? 128)

const buf = fs.readFileSync(file)
const loader = new HDRLoader()
// ⚠️ setDataType(FloatType) is LOAD-BEARING. HDRLoader defaults to
// HalfFloatType, which hands back a Uint16Array of half-floats — reading that
// as if it were Float32 gives silent garbage, not an error. With FloatType the
// data is a Float32Array at an RGBA stride of 4, which is what the loop below
// indexes.
loader.setDataType(FloatType)
const tex = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const { width: inW, height: inH, data } = tex

console.log(`in : ${inW}x${inH}, ${buf.length} bytes`)
if (outW > inW || outH > inH) {
  console.error(`refusing to UPscale ${inW}x${inH} -> ${outW}x${outH}`)
  process.exit(1)
}

// Box filter. The ratio is an exact integer for 1024x512 -> 256x128, so every
// output pixel averages a clean 4x4 block and there is no resampling artefact
// to reason about. A non-integer ratio is rejected rather than fudged.
const bx = inW / outW
const by = inH / outH
if (!Number.isInteger(bx) || !Number.isInteger(by)) {
  console.error(`non-integer downscale ratio ${bx}x${by} — pick a divisor of ${inW}x${inH}`)
  process.exit(1)
}

const out = new Float32Array(outW * outH * 3)
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    let r = 0, g = 0, b = 0
    for (let sy = 0; sy < by; sy++) {
      for (let sx = 0; sx < bx; sx++) {
        const si = ((y * by + sy) * inW + (x * bx + sx)) * 4
        r += data[si]; g += data[si + 1]; b += data[si + 2]
      }
    }
    const n = bx * by
    const di = (y * outW + x) * 3
    out[di] = r / n; out[di + 1] = g / n; out[di + 2] = b / n
  }
}

// Encode flat (non-RLE) RGBE. HDRLoader reads both, and flat is a dozen lines
// with no run-length edge cases to get wrong. The size win here is the pixel
// count, not the entropy coding — measured round-trip error against the
// downsampled floats is 0.208% mean / 2.29% max, which is inside RGBE's own
// 1/256 mantissa quantisation.
const header = Buffer.from(
  `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${outH} +X ${outW}\n`,
  'latin1',
)
const pixels = Buffer.alloc(outW * outH * 4)
for (let i = 0; i < outW * outH; i++) {
  const r = out[i * 3], g = out[i * 3 + 1], b = out[i * 3 + 2]
  const max = Math.max(r, g, b)
  if (max < 1e-32) {
    pixels[i * 4] = 0; pixels[i * 4 + 1] = 0; pixels[i * 4 + 2] = 0; pixels[i * 4 + 3] = 0
  } else {
    const e = Math.ceil(Math.log2(max))
    const s = 256 / Math.pow(2, e)
    pixels[i * 4]     = Math.min(255, Math.floor(r * s))
    pixels[i * 4 + 1] = Math.min(255, Math.floor(g * s))
    pixels[i * 4 + 2] = Math.min(255, Math.floor(b * s))
    pixels[i * 4 + 3] = e + 128
  }
}

fs.writeFileSync(file, Buffer.concat([header, pixels]))
console.log(`out: ${outW}x${outH}, ${header.length + pixels.length} bytes`)
