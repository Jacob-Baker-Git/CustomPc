// The one definition of the content pages' title, description and canonical.
//
// NO IMPORTS. scripts/apply-prerender.mjs loads this under plain Node during
// `npm run build`, and Node's ESM resolver rejects this project's extensionless
// relative imports. Same constraint as src/lib/benchSchema.js — keep it a data
// module and nothing else.
//
// One definition, two readers: App.jsx applies these after mount, and
// apply-prerender bakes them into the served HTML. Two copies would drift, which
// is exactly what `npm run sitemap` and `npm run perf:games` exist to prevent.
export const SITE = 'https://custompcbuilder.netlify.app'

// Giving the pages their own URLs achieves nothing if all six then serve the
// root's title, description and canonical — to a crawler that is six addresses
// for one document, which is the problem hash routes had.
export const PAGE_META = {
  help: {
    title: 'Help & FAQ — Custom PC Builder',
    description: 'How to plan a build, read the CustomPC score, check compatibility and share what you have chosen.',
  },
  parts: {
    title: 'PC Parts Browser — Prices & Specifications',
    description: 'Browse processors, graphics cards, memory, storage and cases with specifications and curated UK price estimates.',
  },
  glossary: {
    title: 'PC Hardware Glossary — Custom PC Builder',
    description: 'Plain-English definitions of the PC building terms — sockets, chipsets, TDP, form factors, VRAM and the rest.',
  },
  feedback: {
    title: 'Feedback — Custom PC Builder',
    description: 'Tell us what worked, what did not, and what is missing.',
  },
  privacy: {
    title: 'Privacy Policy — Custom PC Builder',
    description: 'What this site stores about you, which is nothing personal, and why.',
  },
  terms: {
    title: 'Terms of Use — Custom PC Builder',
    description: 'The terms covering price estimates, compatibility checks and performance figures on this site.',
  },
}

// The root is DELIBERATELY absent above: index.html owns its own copy and
// App.jsx reads it back via captureRootMeta().
export const canonicalFor = (path) => (path ? `${SITE}/${path}` : `${SITE}/`)
