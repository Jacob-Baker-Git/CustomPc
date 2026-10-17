// Production serves the GLBs gzipped (scripts/gzip-models.mjs). Netlify sends
// .glb as application/octet-stream and does not compress that type, yet
// meshopt geometry still halves under gzip — the motherboard goes 7.7 → 3.5 MB.
//
// Dev serves the raw files, and a server that compressed on the wire hands the
// browser a GLB it already decoded, so this sniffs the gzip magic bytes rather
// than trusting a file name or a header.
export async function gunzipIfNeeded(buf) {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength))
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

// drei's useGLTF extendLoader hook: replaces GLTFLoader.load with a fetch that
// unpacks gzip before parsing. Idempotent — r3f calls it on every load with
// the same cached loader, and it never wraps a previous override.
export function loadGzippedGlb(loader) {
  loader.load = (url, onLoad, _onProgress, onError) => {
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
        return r.arrayBuffer()
      })
      .then(gunzipIfNeeded)
      .then((buf) => loader.parse(buf, url.slice(0, url.lastIndexOf('/') + 1), onLoad, onError))
      .catch((e) => onError?.(e))
  }
}
