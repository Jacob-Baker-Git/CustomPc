# Industrial Utilitarian UI/UX Pass — Design

**Date:** 2026-06-16
**Status:** Approved (pending spec review)
**Scope:** Presentational overhaul of the build workspace. No changes to store logic, compatibility, bottleneck/FPS math, or 3D geometry.

## Goal

Restyle the PC-builder workspace to a high-end, precise **"Industrial Utilitarian"** aesthetic — a technical-instrument / HUD feel — while keeping every existing behaviour intact. Four targeted improvements: a polished orbit for the floating part pills, de-SaaS'd sidebar panels, telemetry (monospace) typography for live metrics, and a radial backdrop behind the 3D canvas.

## Design tokens (provenance)

Tokens synthesized from the **UI/UX Pro Max** plugin databases (`styles.csv`), blending four rows:

- **HUD / Sci-Fi FUI** — 1px fine lines, monospace tech fonts, transparent/dark surfaces, restrained cyan, decorative tick markers. `--bg: rgba(0,10,20,0.9)`, `--line-width: 1px`.
- **Brutalism** — sharp corners (`border-radius: 0`), visible thin borders, bold/mono type.
- **Real-Time Monitoring** — subtle live pulse on active indicators, status colours (green/amber/red) already used by the bars.
- **Data-Dense Dashboard** — compact padding, maximum information density.

Resulting system (to live in `src/lib/uiTokens.js`):

| Token | Value (Tailwind) |
|---|---|
| Surface | `bg-slate-950/30 backdrop-blur-md` |
| Border | `border border-slate-800/60` (1px, low-opacity) |
| Corners | `rounded-sm` (≈2px) — sharp, no large radii |
| Accent | cyan `#38bdf8` / `cyan-300`, used sparingly for 1px lines + index dots |
| Glow | removed/minimized — a 1px hairline replaces the heavy `shadow-[0_0_20px]` |
| Telemetry font | JetBrains Mono via `font-mono` |
| Label font | existing sans-serif |

`uiTokens.js` keeps named exports so the look is consistent and one-line tunable. Existing exports (`GLASS`, `GLASS_STRONG`, `ACCENT_TEXT`, etc.) are repointed to the new values; a new `PANEL` token captures the de-SaaS'd panel surface and a `TELEMETRY` constant (`'font-mono'`) marks monospace metrics.

## Cross-cutting decisions

1. **Font: JetBrains Mono.** Loaded via Google Fonts (`<link>` in `index.html`), wired into Tailwind via `theme.extend.fontFamily.mono`. Default `font-sans` (system stack) remains for labels/prose.
2. **Scope: app-wide.** The sharp/translucent surface is applied to every glass surface — top bar, build/peripherals toggle, Bottleneck, Performance, Upgrade suggestion, case toggle, info disclaimer — via the shared token, so nothing looks half-migrated. (Bottleneck + Performance were the explicitly named panels; widening to the rest is for visual cohesion only and changes no behaviour.)

## Improvement 1 — Polished orbit (`src/components/OrbitRing.jsx`)

Chosen direction: **A — Polished orbit** (refined circular ring; keeps live 3D tracking).

- **Orbit path:** draw a faint dashed elliptical guide (`stroke rgba(56,189,248,0.30)`, `stroke-dasharray`) centered on the case, behind the pills, so the ring reads as an intentional orbit rather than scattered pills.
- **Pills (filled):** telemetry chips — `rounded-sm`, 1px border, a leading cyan **index dot** ("satellite"), the part name and `£price` in `font-mono`. Keep the category icon, click-to-open-selector, and ✕-to-remove.
- **Pills (empty):** hollow numbered node + label, retaining the **next-recommended pulse** (`animate-pulse` ring) on the next recommended category.
- **Connector lines:** each line starts `opacity-0` and transitions to visible **only when its own pill is hovered**. Implementation: track a `hoveredCat` state (set on pill `onMouseEnter`/`onMouseLeave`); the line for that category gets `opacity-100`, all others `opacity-0`, with a CSS opacity transition. The existing `requestAnimationFrame` loop that aims each line's endpoint (`x1/y1`) at the live 3D screen position (`partScreenPositions`) is **unchanged** — lines still track the real part, they're just hidden until hover.
- **Depth (light touch):** far-side pills (upper/back arc) rendered slightly dimmer for an orbital depth cue.

## Improvement 2 — De-SaaS panels

Replace the SaaS-card look on `BottleneckIndicator.jsx` and `PerformancePanel.jsx` (and, per the scope decision, the other glass surfaces) :

- From: `bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.15)]`
- To: `bg-slate-950/30 backdrop-blur-md border border-slate-800/60 rounded-sm` (hairline border, no heavy glow).

The panel structure, copy, and the coloured balance/value bars are untouched.

## Improvement 3 — Telemetry typography

Apply `font-mono` (JetBrains Mono) to every **live-updating number**, leaving labels in sans:

- `PerformancePanel.jsx` — the FPS value, value-per-£100 figure.
- `TopBar.jsx` — budget `£`, remaining `£`, wattage `W`, and the edit input.
- `DynamicBars.jsx` — the `value / max` readouts.
- `BottleneckIndicator.jsx` — the balance `%`.
- `OrbitRing.jsx` / `PartCard.jsx` — `£price` figures.

Labels ("budget", "remaining", "est. avg FPS", "Bottleneck", category names) stay sans-serif.

## Improvement 4 — Canvas radial backdrop

In `BuilderScreen.jsx` (build view), add an absolutely-positioned layer behind `<BuildCanvas>` (and behind the orbit/panels), filling the area:

```
absolute inset-0 -z-0  /* behind the canvas */
bg-[radial-gradient(ellipse_55%_55%_at_50%_45%,rgba(45,120,160,0.18),rgba(2,6,23,0)_70%)]
```

A large, faint slate-cyan glow centered behind the tower that drops to pure black at the borders, so the case feels seated in space. The page background stays `bg-gray-950`/black; the gradient only lifts the center.

## Components touched

| File | Change |
|---|---|
| `index.html` | Add JetBrains Mono Google Fonts `<link>` |
| `tailwind.config.js` | `theme.extend.fontFamily.mono = ['JetBrains Mono', ...]` |
| `src/lib/uiTokens.js` | Repoint tokens to Industrial Utilitarian values; add `PANEL`, `TELEMETRY` |
| `src/components/OrbitRing.jsx` | Orbit path, telemetry pills, hover-reveal lines, depth |
| `src/components/BottleneckIndicator.jsx` | De-SaaS surface; mono on `%` |
| `src/components/PerformancePanel.jsx` | De-SaaS surface; mono on FPS + value |
| `src/components/TopBar.jsx` | De-SaaS surface; mono on £/W metrics |
| `src/components/DynamicBars.jsx` | Mono on readouts |
| `src/components/PartCard.jsx` | Mono on price |
| `src/screens/BuilderScreen.jsx` | Radial backdrop layer; de-SaaS the view toggle |
| `src/components/UpgradeSuggestion.jsx`, `CaseToggle.jsx`, `InfoDisclaimer.jsx` | Adopt shared `PANEL` token (cohesion) |

## Testing

- The existing **75 Vitest tests stay green** — all changes are presentational; no store/lib logic is altered.
- Verify in the live dev-server preview with before/after screenshots of the build view (orbit, panels, backdrop) and the metrics (mono font rendering).
- Add a light unit test only if orbit geometry/token logic is extracted into a pure helper.

## Non-goals

- No changes to part data, compatibility, bottleneck/FPS/value math, recommended order, or 3D geometry.
- No new features (no per-game FPS, upgrade projection, GLB swap — those remain on the wishlist).
- No responsive/mobile redesign in this pass.
