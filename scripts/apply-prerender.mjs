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

// injectFragment splices the fragment in between two literal HTML comments,
// <!--app--> and <!--/app-->, that index.html carries around the boot
// placeholder (`<div id="root"><!--app-->…boot markup…<!--/app--></div>`) —
// no parsing, no tag recognition, nothing examined on either side. THREE
// regex/scanner attempts were tried here first, and each failed silently in
// a NEW way:
//   1. non-greedy [\s\S]*? stopped at the FIRST </div></div>: a boot
//      placeholder with an extra nesting level (a spinner ring around a
//      spinner dot) under-matched, leaving the rest of the placeholder
//      dangling in the output.
//   2. greedy [\s\S]* anchored on "some </div> before </body>" over-matched:
//      it backtracked past root's own close and deleted a trailing sibling
//      (a cookie-consent banner, a modal portal root) instead of preserving
//      it.
//   3. a depth-counting scanner over <div>/</div> tokens fixed both of those,
//      but was still markup-shaped, and markup kept having new corners: a
//      genuinely unbalanced div matched a nonsense close instead of
//      throwing; a > inside a div's own attribute value truncated the
//      "opening tag" token and threw the depth count off (a stray dangling
//      </div> in the output, no throw); </div > with whitespace before the
//      bracket was never recognised as a close at all; and a decoy
//      <div id="root"> sitting inside an earlier HTML comment would have had
//      the fragment spliced into the wrong target.
// Every one of those came from trying to work out where the root div ends by
// looking at markup — that is parsing, and a hand-rolled parser keeps
// diverging from a real one in a new place each round. Two explicit markers
// make the boundary a fact instead of an inference: this is immune BY
// CONSTRUCTION to nesting depth, attribute values, whitespace in tags, tag
// case, comments and trailing siblings, because none of it is ever examined
// — and there is no String.replace pattern/replacement-string step left
// either, so the earlier $-substitution hazard has nowhere left to hide.
const START_MARKER = '<!--app-->'
const END_MARKER = '<!--/app-->'

export function injectFragment(html, fragment) {
  const start = html.indexOf(START_MARKER)
  const end = html.indexOf(END_MARKER)
  if (start === -1 || end === -1 || end < start) {
    throw new Error('apply-prerender: could not find the <!--app-->…<!--/app--> markers, in order, in the shell — '
      + 'index.html changed shape, and injecting nothing would ship the boot screen')
  }
  const head = html.slice(0, start)
  const tail = html.slice(end + END_MARKER.length)
  return `${head}${START_MARKER}${fragment}${END_MARKER}${tail}`
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
