// Shared Tailwind class strings for the Industrial Utilitarian look. Literal
// strings so Tailwind's content scanner emits the classes; components compose
// them via template literals.

// De-SaaS'd panel surface: sharp corners, 1px low-opacity border, translucent
// dark glass. Replaces the old rounded-2xl SaaS cards.
export const PANEL = 'bg-slate-950/30 backdrop-blur-md border border-slate-800/60 rounded-sm'

// More opaque variant for popovers / floating menus that sit over busy content.
export const PANEL_STRONG = 'bg-slate-950/60 backdrop-blur-md border border-slate-800/60 rounded-sm'

// Monospace telemetry — apply to live-updating numbers only (labels stay sans).
export const TELEMETRY = 'font-mono'

// Restrained accent helpers.
export const ACCENT_TEXT = 'text-cyan-300'
export const ACCENT_GRAD = 'bg-gradient-to-r from-cyan-500 to-blue-600'
