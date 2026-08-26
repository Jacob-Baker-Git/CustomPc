// Up to two initials for a game title, for the cover plates in GameArt.
//
// Lives here rather than beside the component because eslint's
// react-refresh/only-export-components rule fails a component file that also
// exports a plain function: Fast Refresh cannot tell which export changed, so
// editing the helper would silently stop hot-reloading the component.
//
// The noise words matter more than they look. Without them a library sorted by
// name gives a run of plates all reading "T" — The Witcher, The Last of Us,
// The Finals — which is worse than no plate at all, because it actively
// suggests the rows are the same game.
const SKIP = new Set(['the', 'a', 'an', 'of', 'and', 'in'])

export function initialsFor(name) {
  const words = String(name ?? '')
    // ⚠️ Apostrophes are DELETED, and the order matters. Folding them into the
    // general punctuation rule below turns them into spaces, which splits
    // "Baldur's" into "Baldur" and "s" — so the plate read "BS" instead of
    // "BG". Every possessive title in the library had the same fault.
    .replace(/['’`]/g, '')
    // Everything else becomes a separator. Letters and digits from any script
    // survive, so "Anno 1800" gives A1 rather than AN.
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !SKIP.has(w.toLowerCase()))

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
