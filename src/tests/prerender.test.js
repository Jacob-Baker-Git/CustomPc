import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { applyMeta, injectFragment, escapeAttr } from '../../scripts/apply-prerender.mjs'
import { PAGES as SCRIPT_PAGES } from '../../scripts/prerender-routes.mjs'
import { PAGES as APP_PAGES } from '../hooks/usePageRoute'
import { PAGE_META, canonicalFor } from '../lib/pageMeta'

// A miniature of index.html carrying one of every tag the injector rewrites,
// plus the verification tag it must not touch, and the <!--app-->/<!--/app-->
// markers injectFragment splices around. Modelled on a real `npm run build`
// output (verified by hand), not the source index.html: Vite hoists
// <script type="module"> and the stylesheet <link> into <head>, so <body> in
// the built file contains nothing but the root div — and Vite preserves HTML
// comments unchanged (also verified by hand against real dist output), which
// is what makes the marker splice possible at all.
const SHELL = `<!doctype html>
<html lang="en"><head>
<title>Custom PC Builder — Build &amp; Price Your Gaming PC in 3D</title>
<meta name="description" content="Root description." />
<meta name="google-site-verification" content="4l1jmNOPVTE9FrguZxnUVmpXPi2YM-lS7g0w_8a_3c4" />
<link rel="canonical" href="https://custompcbuilder.netlify.app/" />
<meta property="og:title" content="Root title" />
<meta property="og:description" content="Root description." />
<meta property="og:url" content="https://custompcbuilder.netlify.app/" />
<meta name="twitter:title" content="Root title" />
<meta name="twitter:description" content="Root description." />
<script type="module" crossorigin src="/assets/index-ABC12345.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-XYZ98765.css">
</head><body style="margin:0;background:#0F1114">
<div id="root"><!--app--><div class="boot" style="position:fixed">Custom PC Builder…</div><!--/app--></div>
</body></html>`

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const attrOf = (html, re) => decode(re.exec(html)[1])

describe('applyMeta', () => {
  // Computed fresh before EACH test, not once for the whole block: a throw in
  // applyMeta used to fail all five tests below opaquely (describe-level setup
  // runs once, so a broken shell would report as five unrelated failures with
  // no clear cause). A beforeEach still runs once per test, so a throw here
  // fails only the one test it was setting up, same as the newer tests below
  // that already compute their own `out` inline.
  let out
  beforeEach(() => {
    out = applyMeta(SHELL, {
      title: PAGE_META.help.title,
      description: PAGE_META.help.description,
      canonical: canonicalFor('help'),
    })
  })

  it('rewrites title, description and canonical to the page values', () => {
    expect(attrOf(out, /<title>([\s\S]*?)<\/title>/)).toBe(PAGE_META.help.title)
    expect(attrOf(out, /<meta name="description" content="([^"]*)"/)).toBe(PAGE_META.help.description)
    expect(attrOf(out, /<link rel="canonical" href="([^"]*)"/)).toBe(canonicalFor('help'))
  })

  it('rewrites the og and twitter pairs too, so a social preview is not the root', () => {
    expect(attrOf(out, /<meta property="og:title" content="([^"]*)"/)).toBe(PAGE_META.help.title)
    expect(attrOf(out, /<meta property="og:description" content="([^"]*)"/)).toBe(PAGE_META.help.description)
    expect(attrOf(out, /<meta property="og:url" content="([^"]*)"/)).toBe(canonicalFor('help'))
    expect(attrOf(out, /<meta name="twitter:title" content="([^"]*)"/)).toBe(PAGE_META.help.title)
    expect(attrOf(out, /<meta name="twitter:description" content="([^"]*)"/)).toBe(PAGE_META.help.description)
  })

  it('escapes an ampersand rather than emitting bare & in an attribute', () => {
    // "Help & FAQ — Custom PC Builder" is the live case.
    expect(out).toContain('Help &amp; FAQ')
    expect(escapeAttr('a & "b"')).toBe('a &amp; &quot;b&quot;')
  })

  it('leaves the google-site-verification tag alone', () => {
    // Losing it silently unverifies the Search Console property.
    expect(out).toContain('name="google-site-verification"')
    expect(out).toContain('4l1jmNOPVTE9FrguZxnUVmpXPi2YM-lS7g0w_8a_3c4')
  })

  it('leaves the asset script untouched', () => {
    expect(out).toContain('/assets/index-ABC12345.js')
  })

  it('writes a meta value containing $& literally', () => {
    // $&, $$, $` and $' are substitution syntax in a replacement STRING
    // (whole-match, literal-$, before-match, after-match). Title/description/
    // canonical are content values, not regex internals, so a literal one of
    // these must survive untouched rather than splicing matched text in.
    const withDollar = applyMeta(SHELL, { title: 'A $& B', description: 'C $` D', canonical: 'https://x/$$' })
    expect(withDollar).toContain('<title>A $&amp; B</title>')
    expect(withDollar).toContain('content="C $` D"')
    expect(withDollar).toContain('href="https://x/$$"')
  })

  it('escapes </title> in a title so it cannot terminate the element early', () => {
    // <title> is RCDATA: a lone < is inert there, but the literal sequence
    // </title> ends the element early and everything after it parses as
    // markup. Titles are hand-authored today, but partPages.js builds titles
    // from 540 catalogue parts, so a less-trusted string reaching here is
    // plausible.
    const withTitle = applyMeta(SHELL, {
      title: 'Weird </title><script>alert(1)</script> Title',
      description: PAGE_META.help.description,
      canonical: canonicalFor('help'),
    })
    expect(withTitle).not.toContain('</title><script>')
    expect(withTitle).toContain('<title>Weird &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; Title</title>')
  })
})

describe('injectFragment', () => {
  it('replaces the boot placeholder with the fragment, keeping both markers', () => {
    const out = injectFragment(SHELL, '<main><h1>Glossary</h1></main>')
    expect(out).toContain('<div id="root"><!--app--><main><h1>Glossary</h1></main><!--/app--></div>')
    expect(out).not.toContain('class="boot"')
    expect(out).not.toContain('Custom PC Builder…')
  })

  it('THROWS if the markers are not found', () => {
    // If index.html's boot placeholder is ever edited and the markers get
    // dropped along with it, a silent no-op would ship the boot screen as the
    // pre-rendered content of all seven pages and still look like a
    // successful build. Fail loudly instead.
    expect(() => injectFragment('<body><div id="something-else"></div></body>', '<p>x</p>'))
      .toThrow(/marker/i)
  })

  it('throws if the markers are present but in the wrong order', () => {
    // A hand-edit could paste the closing marker before the opening one by
    // mistake. The markers ARE the entire contract now, so a reversed pair
    // must throw rather than silently slicing head/tail from the wrong ends.
    const shell = '<div id="root"><!--/app-->stuff<!--app--></div></body>'
    expect(() => injectFragment(shell, '<main>PAGE</main>')).toThrow(/marker/i)
  })

  it('inserts a fragment containing $& and $` literally', () => {
    // $&, $$, $` and $' are substitution syntax in a String.replace()
    // replacement STRING. injectFragment does not call String.replace at all
    // any more (see the comment above it), so this is structurally safe now
    // — but it is still worth proving directly: a fragment is arbitrary
    // rendered page HTML, and one of these sequences must survive untouched.
    const out = injectFragment(SHELL, '<p>cost $& and $` and $$ and $\'</p>')
    expect(out).toContain('<p>cost $& and $` and $$ and $\'</p>')
  })

  it('does not care how deeply the old boot placeholder nests', () => {
    // Historical regression (implementation #1, a non-greedy regex): it
    // stopped at the FIRST </div></div>, so a boot placeholder with an extra
    // nesting level (a spinner ring around a spinner dot) under-matched and
    // left the rest dangling in the output. The marker splice never looks at
    // what is between the markers at all, so nesting depth is irrelevant by
    // construction — there is no tag-counting logic left to regress.
    const nestedShell = SHELL.replace(
      '<!--app--><div class="boot" style="position:fixed">Custom PC Builder…</div><!--/app-->',
      '<!--app--><div class="boot"><div class="spinner-ring"><div class="spinner-dot"></div></div>Loading…</div><!--/app-->',
    )
    const out = injectFragment(nestedShell, '<main>PAGE</main>')
    expect(out).toContain('<div id="root"><!--app--><main>PAGE</main><!--/app--></div>')
    expect(out).not.toContain('Loading…')
    expect(out).toMatch(/<div id="root"><!--app--><main>PAGE<\/main><!--\/app--><\/div>\s*<\/body>/)
  })

  it('preserves a trailing sibling <div> after root instead of deleting it', () => {
    // Historical regression (implementation #2, a greedy regex anchored on
    // "some </div> before </body>"): it backtracked past root's own close and
    // deleted a trailing sibling (a cookie-consent banner, a modal portal
    // root) along with the placeholder. The marker splice only ever touches
    // what is between the two markers, so a sibling outside <div id="root">
    // entirely was never at risk.
    const shell = `<html><head></head><body>
<div id="root"><!--app--><div class="boot">Custom PC Builder…</div><!--/app--></div>
<div id="cookie-consent"><p>We use cookies</p></div>
</body></html>`
    const out = injectFragment(shell, '<main>PAGE</main>')
    expect(out).toContain('<div id="root"><!--app--><main>PAGE</main><!--/app--></div>')
    expect(out).toContain('<div id="cookie-consent"><p>We use cookies</p></div>')
  })

  it('preserves a trailing <noscript> after root', () => {
    const shell = `<html><head></head><body>
<div id="root"><!--app--><div class="boot">Custom PC Builder…</div><!--/app--></div>
<noscript>Enable JavaScript to use this site.</noscript>
</body></html>`
    const out = injectFragment(shell, '<main>PAGE</main>')
    expect(out).toContain('<div id="root"><!--app--><main>PAGE</main><!--/app--></div>')
    expect(out).toContain('<noscript>Enable JavaScript to use this site.</noscript>')
  })

  it('preserves content after </body> unchanged', () => {
    const shell = '<div id="root"><!--app--><div class="boot">Loading…</div><!--/app--></div>\n</body></html>\n<!-- trailing comment -->'
    const out = injectFragment(shell, '<main>PAGE</main>')
    expect(out).toBe('<div id="root"><!--app--><main>PAGE</main><!--/app--></div>\n</body></html>\n<!-- trailing comment -->')
  })

  it('handles a > inside a div attribute value between the markers', () => {
    // Historical regression (implementation #3, a depth-counting scanner):
    // <div\b[^>]*> stopped at the FIRST >, wherever it was, so a > inside an
    // attribute value truncated the "opening tag" token and threw the depth
    // count off — a stray dangling </div> in the output, no throw. The
    // marker splice never looks at tag structure, so this is just opaque
    // bytes between two comments.
    const shell = '<div id="root"><!--app--><div title="a>b</div>c">TEXT</div><!--/app--></div>\n</body></html>'
    const out = injectFragment(shell, '<main>PAGE</main>')
    expect(out).toBe('<div id="root"><!--app--><main>PAGE</main><!--/app--></div>\n</body></html>')
  })

  it('handles </div > with a space, plus a stray extra closing div, between the markers', () => {
    // Historical regression (implementation #3): </div> was matched
    // literally with no whitespace tolerance, so </div > (a space before the
    // bracket) was never recognised as a close, throwing the depth count off
    // against an unrelated stray </div> elsewhere in the same markup. The
    // marker splice does not parse tags at all, so none of this is examined.
    const shell = '<div id="root"><!--app--><div class="x">a</div ><div class="y"></div></div>text<!--/app--></div>\n</body></html>'
    const out = injectFragment(shell, '<main>PAGE</main>')
    expect(out).toBe('<div id="root"><!--app--><main>PAGE</main><!--/app--></div>\n</body></html>')
  })

  it('is not fooled by a decoy <div id="root"> inside an earlier comment', () => {
    // Historical regression (all three implementations): each located root
    // by the FIRST occurrence of the literal string <div id="root">, so a
    // decoy inside an HTML comment earlier in the document (a commented-out
    // alternate skeleton, a stale snippet) would have the fragment spliced
    // into the wrong target. The marker splice searches for <!--app--> only,
    // which nothing in this decoy spells out.
    const shell = '<!-- old skeleton: <div id="root"><div class="old"></div></div> -->'
      + '<div id="root"><!--app--><div class="boot">Loading…</div><!--/app--></div>\n</body></html>'
    const out = injectFragment(shell, '<main>PAGE</main>')
    expect(out).toContain('<!-- old skeleton: <div id="root"><div class="old"></div></div> -->')
    expect(out).toContain('<div id="root"><!--app--><main>PAGE</main><!--/app--></div>')
  })
})

describe('route list', () => {
  it('the build scripts route list matches the router', () => {
    // Two definitions exist only because plain Node cannot import the router.
    // This is the check that keeps them honest — the same contract
    // sitemap.test.js holds over the sitemap.
    expect([...SCRIPT_PAGES].sort()).toEqual([...APP_PAGES].sort())
  })
})

describe('the committed fragments', () => {
  // resolve off cwd, not import.meta.url, for the same reason as the marker
  // contract test below: under jsdom import.meta.url is an http:// URL and
  // readFileSync rejects it.
  const dir = resolve(process.cwd(), 'prerendered')
  const read = (n) => readFileSync(join(dir, `${n}.html`), 'utf8')
  const names = readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''))

  // The fragments are markup, and the copy they must contain is split across
  // tags — the landing h1 is `Custom PC <span>Builder</span>`. Asserting on the
  // rendered TEXT rather than the raw HTML tests the thing that actually
  // matters (a crawler reads text) and does not break the next time someone
  // wraps a word in a span for styling.
  const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  it('covers the root and every content route, and nothing else', () => {
    expect([...names].sort()).toEqual([...['index', ...APP_PAGES]].sort())
  })

  it('holds no boot placeholder and nothing trivially short', () => {
    // A fragment captured before the app settled is worse than none: it ships a
    // loading message as the page's indexable content.
    for (const n of names) {
      const html = read(n)
      expect(html, `${n} still holds the boot placeholder`).not.toContain('class="boot"')
      expect(html.length, `${n} is suspiciously short`).toBeGreaterThan(500)
    }
  })

  it('embeds NO asset hash — the constraint the design rests on', () => {
    // Vite rehashes every build. A committed hash means the next deploy serves
    // HTML pointing at bundles that 404, while still returning 200.
    for (const n of names) {
      expect(read(n), `${n} embeds a hashed asset URL`).not.toMatch(/(assets|index)-[A-Za-z0-9_-]{8}\./)
    }
  })

  it('carries no <!--app--> marker of its own', () => {
    // The capture takes #root's innerHTML AFTER React has mounted, and
    // createRoot clears the container (textContent = ''), which removes the
    // markers along with the boot div — so a fragment should never contain
    // them. If React ever stopped clearing, injectFragment would splice a
    // marker-bearing fragment between the shell's own pair and the nested
    // result would make a second apply-prerender run cut at the wrong place.
    // Verified empirically on React 19.2 at capture time; this pins it.
    for (const n of names) {
      expect(read(n), `${n} carries an app marker`).not.toMatch(/<!--\/?app-->/)
    }
  })

  it('puts real landing copy in the root fragment', () => {
    const text = textOf(read('index'))
    expect(text).toContain('Custom PC Builder')
    expect(text).toMatch(/Build and price a gaming PC in 3D/i)
  })
})

describe('index.html marker contract', () => {
  it('carries <!--app--> and <!--/app--> around the boot placeholder inside #root', () => {
    // apply-prerender.mjs splices each page's fragment in between these two
    // literal comments and nowhere else — see injectFragment. If someone ever
    // "cleans up" the boot div and drops the comments, `npm run build` would
    // throw (injectFragment can't find them) — but that is a build-time
    // failure. This test catches it at commit time instead, before it can
    // reach a deploy at all.
    //
    // resolve off cwd, not import.meta.url: under jsdom that is an http:// URL
    // and readFileSync rejects it. Same approach as sitemap.test.js.
    const real = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const rootStart = real.indexOf('<div id="root">')
    const startMarker = real.indexOf('<!--app-->')
    const endMarker = real.indexOf('<!--/app-->')
    expect(rootStart).toBeGreaterThan(-1)
    expect(startMarker).toBeGreaterThan(rootStart)
    expect(endMarker).toBeGreaterThan(startMarker)
  })
})
