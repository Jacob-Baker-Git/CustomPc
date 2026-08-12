import { describe, it, expect } from 'vitest'
import { applyMeta, injectFragment, escapeAttr } from '../../scripts/apply-prerender.mjs'
import { PAGES as SCRIPT_PAGES } from '../../scripts/prerender-routes.mjs'
import { PAGES as APP_PAGES } from '../hooks/usePageRoute'
import { PAGE_META, canonicalFor } from '../lib/pageMeta'

// A miniature of index.html carrying one of every tag the injector rewrites,
// plus the verification tag it must not touch.
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
</head><body style="margin:0;background:#0F1114">
<div id="root"><div class="boot" style="position:fixed">Custom PC Builder…</div></div>
<script type="module" src="/assets/index-ABC12345.js"></script>
</body></html>`

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const attrOf = (html, re) => decode(re.exec(html)[1])

describe('applyMeta', () => {
  const out = applyMeta(SHELL, {
    title: PAGE_META.help.title,
    description: PAGE_META.help.description,
    canonical: canonicalFor('help'),
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
    const out = applyMeta(SHELL, { title: 'A $& B', description: 'C $` D', canonical: 'https://x/$$' })
    expect(out).toContain('<title>A $&amp; B</title>')
    expect(out).toContain('content="C $` D"')
    expect(out).toContain('href="https://x/$$"')
  })
})

describe('injectFragment', () => {
  it('replaces the boot placeholder with the fragment', () => {
    const out = injectFragment(SHELL, '<main><h1>Glossary</h1></main>')
    expect(out).toContain('<div id="root"><main><h1>Glossary</h1></main></div>')
    expect(out).not.toContain('class="boot"')
    expect(out).not.toContain('Custom PC Builder…')
  })

  it('THROWS if the placeholder is not found', () => {
    // If index.html's root div is ever restyled, a silent no-op would ship the
    // boot screen as the pre-rendered content of all seven pages and still look
    // like a successful build. Fail loudly instead.
    expect(() => injectFragment('<body><div id="app"></div></body>', '<p>x</p>'))
      .toThrow(/root/i)
  })

  it('inserts a fragment containing $& and $` literally', () => {
    // $&, $$, $` and $' are substitution syntax in a replacement STRING. A
    // fragment is arbitrary rendered page HTML, so if any page ever renders one
    // of these the committed pre-render would be silently corrupted.
    const out = injectFragment(SHELL, '<p>cost $& and $` and $$ and $\'</p>')
    expect(out).toContain('<p>cost $& and $` and $$ and $\'</p>')
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
