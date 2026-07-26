// Shared Tailwind class strings for the Workbench look. Literal strings so
// Tailwind's content scanner emits the classes; components compose them via
// template literals. Colours resolve from the CSS vars in src/index.css via
// the semantic Tailwind tokens in tailwind.config.js.

// Solid card surface: friendly rounded corners, 1px hairline, real contrast.
// (Replaces the old translucent slate "glass" that read as low-contrast.)
export const PANEL = 'bg-surface border border-line rounded-xl'

// Raised variant for popovers / floating menus that sit over busy content.
export const PANEL_STRONG = 'bg-surface-2 border border-line-strong rounded-xl'

// Monospace telemetry — apply to live-updating numbers only (labels stay sans).
export const TELEMETRY = 'font-mono tabular-nums'

// Restrained accent helpers.
export const ACCENT_TEXT = 'text-accent'

// Flat primary action — one warm accent, dark ink on top, no gradients or glows.
export const BTN_PRIMARY = 'bg-accent hover:brightness-110 text-accent-ink font-semibold'
