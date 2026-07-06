import '@testing-library/jest-dom'

// jsdom (29.x) doesn't implement scrollTo on elements or window, and several
// components call it inside effects (e.g. BuilderScreen scrolls to top on view
// change). No-op it so full mounts don't throw in tests.
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {}
}
