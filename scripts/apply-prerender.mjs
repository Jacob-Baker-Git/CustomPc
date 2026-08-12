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

// Matched GREEDILY, anchored on what precedes </body> — not on the root div's
// own first closing pair. Verified by hand against a real `npm run build`:
// Vite hoists <script type="module"> and the stylesheet <link> into <head>,
// so <body> in dist/index.html contains nothing but the root div. That is
// what makes anchoring on </body> safe rather than just convenient.
//
// A non-greedy [\s\S]*? up to the first </div></div> was tried first and is
// wrong: if the boot placeholder ever gains a nesting level (a spinner ring
// around a spinner dot), the FIRST </div></div> belongs to the inner
// elements, not to root. The regex still matches — the guard below does not
// throw — but on a PROPER PREFIX of the root div, leaving the rest of the
// placeholder dangling outside the injected fragment. Anchoring on </body>
// instead means the only way to match at all is to consume every nested
// closing tag up to root's own, so a wrong-but-successful prefix match is not
// possible: either the real root div is matched in full, or (if <body> ever
// contains something after it) nothing matches and the guard throws.
const ROOT_RE = /<div id="root">[\s\S]*<\/div>(?=\s*<\/body>)/

export function injectFragment(html, fragment) {
  if (!ROOT_RE.test(html)) {
    throw new Error('apply-prerender: could not find the #root placeholder in the shell — '
      + 'index.html changed shape, and injecting nothing would ship the boot screen')
  }
  // A replacer FUNCTION, not a template string: fragment is arbitrary rendered
  // page HTML captured by Playwright (Task 3). $&, $$, $` and $' are
  // substitution syntax in a replacement STRING — insert-whole-match,
  // literal-$, insert-text-before-match, insert-text-after-match — so a page
  // that happens to render one of those sequences into a template string
  // would silently splice matched or surrounding HTML into the fragment. A
  // function's return value is inserted verbatim; nothing reprocesses it.
  return html.replace(ROOT_RE, () => `<div id="root">${fragment}</div>`)
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
