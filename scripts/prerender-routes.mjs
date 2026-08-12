// The route list, re-exported for the build scripts.
//
// src/hooks/usePageRoute.js is the real definition, but it imports React and
// uses extensionless relative imports, so plain Node cannot load it. Re-listing
// the six here would be a second definition — so a test asserts these two agree.
export const PAGES = ['help', 'parts', 'glossary', 'feedback', 'privacy', 'terms']
