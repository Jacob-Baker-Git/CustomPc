// Injects the committed pre-rendered fragments into a freshly built dist/.
//
//   node scripts/apply-prerender.mjs      (run by `npm run build`)
//
// WHY THIS IS SPLIT FROM scripts/prerender.mjs: a committed pre-render must not
// contain asset URLs. Vite emits content-hashed bundles, so a committed whole
// document freezes one build's hashes and every later build then serves HTML
// referencing scripts that 404 — a silently broken deploy, because the HTML
// still returns 200 and only the bundles are missing.
//
// So the committed artefact is a body FRAGMENT, and the hashes come from the
// dist/index.html Vite has just written. Netlify runs this and needs no browser.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { PAGE_META, canonicalFor } from '../src/lib/pageMeta.js'
import { PAGES } from './prerender-routes.mjs'

const DIST = new URL('../dist/', import.meta.url)
const FRAGMENTS = new URL('../prerendered/', import.meta.url)

// Safe for HTML attribute values (content="...", href="...") AND for RCDATA
// text nodes (<title>...</title>) — one helper covers both rather than
// risking the wrong one being reached for at a call site. & and " alone would
// cover the attribute-value case, but <title> is RCDATA: a lone < is inert
// there, while the literal sequence </title> ends the element early and
// everything after it is parsed as markup — so < (and, for symmetry, >) must
// be escaped too. Escaping them in an attribute value is harmless and valid,
// so widening this one helper costs the attribute case nothing.
export const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// injectFragment locates the root div's own closing tag by walking tags and
// counting nesting depth, rather than matching it with a single regex. TWO
// regex attempts were tried here first and BOTH failed silently:
//   - a NON-GREEDY match up to the first </div></div> UNDER-matched: a boot
//     placeholder with an extra nesting level (a spinner ring around a
//     spinner dot) closes its own inner divs first, so the match stopped
//     there. No throw — but the match was a proper prefix of the root div,
//     and the rest of the placeholder was left dangling in the output.
//   - a GREEDY match anchored on a "some </div> before </body>" lookahead
//     OVER-matched: the lookahead has no idea WHICH </div> closes root, so it
//     backtracked past root's own close and swallowed a trailing sibling (a
//     cookie-consent banner, a modal portal root) — silently deleting it.
// Matching balanced, nested tags isn't something a regular expression can do
// (it isn't a regular language), so a third regex would only relocate the
// hazard again. Counting depth is the structurally correct fix: it finds the
// exact tag that brings nesting back to zero regardless of how deep the
// placeholder nests or what comes after it, so both failure modes above are
// impossible by construction. It also drops the </body> anchor entirely, so
// it no longer depends on Vite hoisting the script and stylesheet out of
// <body> — it would be equally correct if that ever changed.
const DIV_TAG_RE = /<div\b[^>]*>|<\/div>/g
const ROOT_OPEN = '<div id="root">'

// Returns { head, tail } split around the root div's own matching close tag —
// tail is everything from just after that close tag to the end of the input,
// preserved untouched — or null if the opening tag is missing, or the tags
// after it never bring the nesting depth back to zero before input runs out
// (unbalanced markup).
//
// This is a scanner over our own build output, not a general HTML parser: it
// assumes (as the old regex did too) well-formed tags with no literal '>'
// inside a div's own attribute values, which holds for the hand-written boot
// placeholder in index.html — the only markup it ever actually walks, since
// the fragment being injected is never scanned, only spliced in as-is.
function findRootBounds(html) {
  const start = html.indexOf(ROOT_OPEN)
  if (start === -1) return null

  DIV_TAG_RE.lastIndex = start + ROOT_OPEN.length
  let depth = 1
  let tag
  while ((tag = DIV_TAG_RE.exec(html))) {
    depth += tag[0] === '</div>' ? -1 : 1
    if (depth === 0) {
      return { head: html.slice(0, start), tail: html.slice(DIV_TAG_RE.lastIndex) }
    }
  }
  return null
}

export function injectFragment(html, fragment) {
  const bounds = findRootBounds(html)
  if (!bounds) {
    throw new Error('apply-prerender: could not find a balanced #root placeholder in the shell — '
      + 'index.html changed shape, and injecting nothing would ship the boot screen')
  }
  // Plain concatenation, not html.replace(pattern, replacement): there is no
  // pattern/replacement-string step left to have a $-substitution hazard, but
  // staying off String.replace here also means never reintroducing one.
  return `${bounds.head}<div id="root">${fragment}</div>${bounds.tail}`
}

// A replacer FUNCTION, not a template string, for the same reason as
// injectFragment above: title/description/canonical are content values, and
// escapeAttr only escapes & and " — not $ — so e.g. the value "A $& B" becomes
// "A $&amp; B", which still contains the literal substitution sequence $&. A
// template string would let that overwrite p1/p2 with the pattern's own
// matched text instead of the escaped value. The function's return value
// bypasses $-substitution entirely.
const swapAttr = (html, pattern, value) => html.replace(pattern, (_match, p1, p2) => `${p1}${escapeAttr(value)}${p2}`)

export function applyMeta(html, { title, description, canonical }) {
  // Same hazard as swapAttr: a title containing "$&" (or $$, $`, $') would be
  // corrupted by a template-string replacement. See swapAttr above.
  let out = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeAttr(title)}</title>`)
  out = swapAttr(out, /(<meta name="description" content=")[^"]*(")/, description)
  out = swapAttr(out, /(<meta property="og:title" content=")[^"]*(")/, title)
  out = swapAttr(out, /(<meta property="og:description" content=")[^"]*(")/, description)
  out = swapAttr(out, /(<meta property="og:url" content=")[^"]*(")/, canonical)
  out = swapAttr(out, /(<meta name="twitter:title" content=")[^"]*(")/, title)
  out = swapAttr(out, /(<meta name="twitter:description" content=")[^"]*(")/, description)
  out = swapAttr(out, /(<link rel="canonical" href=")[^"]*(")/, canonical)
  return out
}

function main() {
  const shell = readFileSync(new URL('index.html', DIST), 'utf8')
  const read = (name) => readFileSync(new URL(`${name}.html`, FRAGMENTS), 'utf8')
  let written = 0

  // The six content pages: fragment AND head.
  for (const page of PAGES) {
    const html = applyMeta(injectFragment(shell, read(page)), {
      title: PAGE_META[page].title,
      description: PAGE_META[page].description,
      canonical: canonicalFor(page),
    })
    mkdirSync(new URL(`${page}/`, DIST), { recursive: true })
    writeFileSync(new URL(`${page}/index.html`, DIST), html)
    written += 1
  }

  // The root: BODY ONLY. index.html already carries the correct title,
  // description, canonical and OG block, plus the google-site-verification tag
  // that regenerating the head would drop.
  writeFileSync(new URL('index.html', DIST), injectFragment(shell, read('index')))
  written += 1

  console.log(`apply-prerender: wrote ${written} pre-rendered pages into dist/`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(new URL('index.html', FRAGMENTS))) {
    console.error('apply-prerender: prerendered/ is empty — run `npm run prerender` first')
    process.exit(1)
  }
  main()
}
