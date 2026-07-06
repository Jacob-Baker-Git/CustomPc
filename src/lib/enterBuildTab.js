// Force the Build tab when entering the builder from a wizard/menu. Without
// this, useHashView restores a stale #summary/#saved from a previous session
// and the freshly generated build opens on the wrong tab.
export function enterBuildTab() {
  if (typeof window !== 'undefined') window.location.hash = 'build'
}
