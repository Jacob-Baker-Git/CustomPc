// The route list, re-exported for the build scripts.
//
// src/hooks/usePageRoute.js is the real definition, but it imports React and
// uses extensionless relative imports, so plain Node cannot load it. Re-listing
// the six here would be a second definition — so a test asserts these two agree.
//
// scripts/build-sitemap.mjs solves the same "plain Node can't import the app"
// problem differently: it spins up a Vite dev server and reads the real module
// via ssrLoadModule, so there is only ever one definition. That's the right
// call for a script run by hand occasionally. This one is different: Netlify
// runs apply-prerender.mjs synchronously as part of every `npm run build`, and
// pulling in a Vite server just to read six rarely-changing strings would make
// every deploy slower for no real benefit. So this file trades "one source of
// truth" for "small, dependency-light and synchronous," with the "route list"
// test in src/tests/prerender.test.js as the guardrail against the two
// drifting (the same role sitemap.test.js plays for the sitemap).
export const PAGES = ['help', 'parts', 'glossary', 'feedback', 'privacy', 'terms']
