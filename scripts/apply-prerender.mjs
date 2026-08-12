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

export const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')

// The root div is matched non-greedily up to its own closing pair. index.html is
// ours and stable, and a mismatch throws rather than passing the input through:
// a silent no-op would ship the boot screen as every page's content.
const ROOT_RE = /<div id="root">[\s\S]*?<\/div><\/div>/

export function injectFragment(html, fragment) {
  if (!ROOT_RE.test(html)) {
    throw new Error('apply-prerender: could not find the #root placeholder in the shell — '
      + 'index.html changed shape, and injecting nothing would ship the boot screen')
  }
  return html.replace(ROOT_RE, `<div id="root">${fragment}</div>`)
}

const swapAttr = (html, pattern, value) => html.replace(pattern, `$1${escapeAttr(value)}$2`)

export function applyMeta(html, { title, description, canonical }) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`)
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
