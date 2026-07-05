# Custom PC Builder

Plan a compatible custom gaming PC in 3D — live at [custompcbuilder.netlify.app](https://custompcbuilder.netlify.app/).

Enter a budget (or pick a quick-start tier), then assemble a build part by part.
The app checks compatibility as you go, estimates real-game FPS, flags
bottlenecks, and renders the machine in an interactive 3D case.

## Features

- **3D build view** — parts appear inside a stylised case as you pick them (react-three-fiber), with a see-through toggle
- **Auto-build** — fills the remaining slots with the best-value compatible parts for your budget
- **Compatibility guardrails** — socket, RAM type, PSU wattage, GPU length / cooler height vs. case dimensions
- **Performance estimates** — bottleneck balance, est. average FPS at 1080p/1440p/4K, and per-game FPS for popular titles
- **Budget tracking** — live spend/remaining, parts over budget are locked (swaps credit back the part you're replacing)
- **Peripherals** — monitor, keyboard, mouse, headset alongside the core build
- **Save, share & compare** — named saved builds (localStorage), shareable `?build=` links, print/markdown export, side-by-side comparison of two saved builds
- **The in-progress build persists** across refreshes

## Stack

React 19 + Vite, Tailwind CSS, Zustand (state), three.js via @react-three/fiber + drei, Vitest + Testing Library.

Prices and performance scores are curated estimates in `src/data/partsData.json` — not live retailer data.

## Development

```bash
npm install
npm run dev        # dev server on :5173
npm run test:run   # vitest suite
npm run test:e2e   # Playwright end-to-end (needs npx playwright install chromium)
npm run lint       # eslint
npm run build      # production build
npm run og:image   # regenerate the social preview card
```

Deploys automatically to Netlify from `main`.
