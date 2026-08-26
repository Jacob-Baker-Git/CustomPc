// A small, stable integer derived from a part or game id.
//
// The drawings in components/art use it to vary a detail or two — how many
// fans a card has, whether a drive is drawn as M.2 or 2.5in — so a grid of
// eighty parts does not read as one tile stamped eighty times.
//
// It has to be DETERMINISTIC. A random pick would redraw the same part
// differently on every render, which turns a quiet list into a flicker and
// makes any screenshot test worthless. Same id in, same number out, forever.
//
// FNV-1a, 32-bit. Chosen because it is four lines and has no dependencies;
// nothing here needs cryptographic quality, only an even spread over small
// moduli for the short ASCII ids this catalogue uses ("gpu-rtx-4070", "cs2").
export function artVariant(seed) {
  const s = String(seed ?? '')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    // The FNV prime, as shifts: h * 16777619 overflows a double's integer
    // range through Math.imul-free multiplication and starts losing low bits.
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0
  }
  return h >>> 0
}
