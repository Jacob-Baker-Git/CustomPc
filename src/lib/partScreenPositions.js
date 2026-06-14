// Shared, mutable store of each selected part's live screen position, written
// every frame by ScreenTracker (inside the Canvas) and read by OrbitRing's rAF
// loop. Kept outside React state so per-frame updates don't trigger re-renders.
export const partScreenPositions = { positions: {}, size: { w: 0, h: 0 } }
