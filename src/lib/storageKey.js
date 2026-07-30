// The zustand-persist key for the builder's state. Lives alone, with no
// imports, so the root ErrorBoundary can clear corrupt state without pulling
// the store in — a store-shaped crash must not also break the crash page.
export const BUILDER_STORAGE_KEY = 'custompc-builder-v1'
